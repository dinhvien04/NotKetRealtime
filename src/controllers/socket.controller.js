const presenceModel = require("../models/presence.model");
const messageModel = require("../models/message.model");
const uploadModel = require("../models/upload.model");
const conversationRepository = require("../repositories/conversation.repository");
const messageRepository = require("../repositories/message.repository");
const userRepository = require("../repositories/user.repository");
const messageService = require("../services/message.service");
const conversationMessageService = require("../services/conversation-message.service");
const realtimeService = require("../services/realtime.service");
const { sanitizeMessage } = require("../utils/sanitize");

function emitOnlineUsers(io) {
  io.emit("online_users", presenceModel.getAllOnline());
}

function reply(callback, payload) {
  if (typeof callback === "function") {
    callback(payload);
  }
}

function getSocketUser(socket) {
  return socket.data.user || null;
}

function registerSocketController(io) {
  io.on("connection", (socket) => {
    const user = getSocketUser(socket);
    if (!user) {
      socket.disconnect(true);
      return;
    }

    presenceModel.addPresence(socket.id, user);
    socket.join(`user:${user.id}`);
    emitOnlineUsers(io);

    socket.on("join_chat", async (_payload, callback) => {
      try {
        const publicRoom = await conversationRepository.ensurePublicParticipant(
          user.id
        );
        socket.join(`conversation:${publicRoom.id}`);
        reply(callback, { ok: true, user, publicRoom });
        emitOnlineUsers(io);
      } catch (error) {
        reply(callback, {
          ok: false,
          error: error.message || "Không thể tham gia phòng chat."
        });
      }
    });

    socket.on("load_conversations", async (_payload, callback) => {
      try {
        const conversations = await conversationRepository.listForUser(user.id);
        reply(callback, { ok: true, conversations });
      } catch (error) {
        reply(callback, {
          ok: false,
          error: error.message || "Không thể tải danh sách hội thoại."
        });
      }
    });

    socket.on("load_messages", async (payload = {}, callback) => {
      try {
        const conversationId = payload.conversationId;
        if (!conversationId) {
          reply(callback, {
            ok: false,
            error: "Thiếu conversationId.",
            messages: []
          });
          return;
        }

        const conversation = await conversationRepository.getById(conversationId);
        if (!conversation) {
          reply(callback, {
            ok: false,
            error: "Hội thoại không tồn tại.",
            messages: []
          });
          return;
        }

        const allowed = await conversationRepository.canAccessConversation(
          conversationId,
          user.id
        );
        if (!allowed) {
          reply(callback, {
            ok: false,
            error: "Bạn không có quyền xem hội thoại này.",
            messages: []
          });
          return;
        }

        const otherUser =
          conversation.type === "direct"
            ? await conversationRepository.getOtherParticipant(
                conversationId,
                user.id
              )
            : null;

        const result = await messageModel.getMessagesForConversation({
          conversationId,
          limit: payload.limit,
          cursor: payload.cursor
        });

        const messages = result.messages.map((message) => ({
          ...message,
          receiverId: otherUser?.id || null
        }));

        reply(callback, {
          ok: true,
          messages,
          nextCursor: result.nextCursor,
          hasMore: result.hasMore,
          conversationId,
          conversation,
          otherUser
        });
      } catch (error) {
        reply(callback, {
          ok: false,
          error: error.message || "Không thể tải tin nhắn.",
          messages: []
        });
      }
    });

    socket.on("load_public_room", async (_payload, callback) => {
      try {
        const room = await conversationRepository.getPublicRoomForUser(user.id);
        reply(callback, { ok: true, room });
      } catch (error) {
        reply(callback, {
          ok: false,
          error: error.message || "Không thể tải phòng public."
        });
      }
    });

    socket.on("load_groups", async (_payload, callback) => {
      try {
        const groups = await conversationRepository.listGroupsForUser(user.id);
        reply(callback, { ok: true, groups });
      } catch (error) {
        reply(callback, {
          ok: false,
          error: error.message || "Không thể tải danh sách nhóm."
        });
      }
    });

    socket.on("join_conversation", async (payload = {}, callback) => {
      try {
        const { conversationId } = payload;
        if (!conversationId) {
          reply(callback, { ok: false, error: "Thiếu conversationId." });
          return;
        }

        const allowed = await conversationRepository.canAccessConversation(
          conversationId,
          user.id
        );
        if (!allowed) {
          reply(callback, { ok: false, error: "Không có quyền tham gia hội thoại." });
          return;
        }

        socket.join(`conversation:${conversationId}`);
        const conversation = await conversationRepository.getById(conversationId);
        reply(callback, { ok: true, conversation });
      } catch (error) {
        reply(callback, {
          ok: false,
          error: error.message || "Không thể tham gia hội thoại."
        });
      }
    });

    socket.on("leave_conversation", (payload = {}) => {
      if (payload.conversationId) {
        socket.leave(`conversation:${payload.conversationId}`);
      }
    });

    async function handleRoomMessage(expectedType, eventName, payload, callback) {
      try {
        const conversationId = payload.conversationId;
        if (!conversationId) {
          reply(callback, { ok: false, error: "Thiếu conversationId." });
          return;
        }

        const result = await conversationMessageService.sendRoomMessage({
          user,
          conversationId,
          payload,
          expectedType
        });

        const outbound = result.message;
        if (expectedType === "public") {
          io.to(`conversation:${conversationId}`).emit(eventName, outbound);
        } else {
          await realtimeService.emitToConversation(conversationId, eventName, outbound);
        }

        reply(callback, { ok: true, message: outbound });
      } catch (error) {
        reply(callback, {
          ok: false,
          error: error.message || "Không thể gửi tin nhắn."
        });
      }
    }

    socket.on("public_message", (payload, callback) => {
      handleRoomMessage("public", "public_message", payload, callback);
    });

    socket.on("group_message", (payload, callback) => {
      handleRoomMessage("group", "group_message", payload, callback);
    });

    socket.on("private_message", async (payload = {}, callback) => {
      const messageType = payload.type || "text";

      try {
        let conversationId;
        let receiverId;

        if (payload.conversationId) {
          conversationId = payload.conversationId;

          const allowed = await conversationRepository.isParticipant(
            conversationId,
            user.id
          );
          if (!allowed) {
            reply(callback, {
              ok: false,
              error: "Bạn không có quyền gửi tin nhắn trong hội thoại này."
            });
            return;
          }

          const otherUser = await conversationRepository.getOtherParticipant(
            conversationId,
            user.id
          );
          if (!otherUser) {
            reply(callback, {
              ok: false,
              error: "Không tìm thấy người nhận trong hội thoại."
            });
            return;
          }

          receiverId = otherUser.id;

          if (payload.receiverId && payload.receiverId !== receiverId) {
            reply(callback, {
              ok: false,
              error: "Người nhận không thuộc hội thoại này."
            });
            return;
          }
        } else {
          receiverId = payload.receiverId;

          if (!receiverId || receiverId === user.id) {
            reply(callback, {
              ok: false,
              error: "Người nhận không hợp lệ."
            });
            return;
          }

          const receiver = await userRepository.findById(receiverId);
          if (!receiver) {
            reply(callback, {
              ok: false,
              error: "Người nhận không tồn tại."
            });
            return;
          }

          conversationId =
            await conversationRepository.findOrCreateDirectConversation(
              user.id,
              receiverId
            );

          const allowed = await conversationRepository.isParticipant(
            conversationId,
            user.id
          );
          if (!allowed) {
            reply(callback, {
              ok: false,
              error: "Bạn không có quyền gửi tin nhắn trong hội thoại này."
            });
            return;
          }
        }

        let messagePayload;

        if (messageType === "text") {
          const content = sanitizeMessage(payload.message || payload.text);
          if (!content) {
            reply(callback, {
              ok: false,
              error: "Không thể gửi tin nhắn trống."
            });
            return;
          }
          messagePayload = {
            type: "text",
            message: content,
            replyToMessageId: payload.replyToMessageId || null
          };
        } else if (
          messageType === "image" ||
          messageType === "file" ||
          messageType === "voice"
        ) {
          const pendingUpload = uploadModel.consumePendingUpload(
            user.id,
            payload.fileKey
          );

          if (!pendingUpload) {
            reply(callback, {
              ok: false,
              error: "File chưa được upload hợp lệ hoặc đã hết hạn."
            });
            return;
          }

          if (
            pendingUpload.fileKey !== payload.fileKey ||
            pendingUpload.fileName !== payload.fileName ||
            pendingUpload.mimeType !== payload.mimeType ||
            Number(pendingUpload.size) !== Number(payload.size)
          ) {
            reply(callback, {
              ok: false,
              error: "Metadata file không khớp với upload đã xác thực."
            });
            return;
          }

          if (
            pendingUpload.kind === "voice" &&
            Number(pendingUpload.durationMs) !== Number(payload.durationMs)
          ) {
            reply(callback, {
              ok: false,
              error: "Thời lượng voice không khớp với upload đã xác thực."
            });
            return;
          }

          messagePayload = {
            type: pendingUpload.kind,
            fileUrl: pendingUpload.fileUrl,
            fileKey: pendingUpload.fileKey,
            fileName: pendingUpload.fileName,
            mimeType: pendingUpload.mimeType,
            size: pendingUpload.size,
            durationMs: pendingUpload.durationMs || null,
            replyToMessageId: payload.replyToMessageId || null
          };
        } else {
          reply(callback, {
            ok: false,
            error: "Loại tin nhắn không được hỗ trợ."
          });
          return;
        }

        const message = await messageModel.createMessage({
          conversationId,
          senderId: user.id,
          senderName: user.displayName || user.username,
          receiverId,
          payload: messagePayload
        });

        await conversationRepository.touchConversation(conversationId);

        const outbound = {
          ...message,
          conversationId,
          receiverId
        };

        io.to(`user:${receiverId}`).emit("private_message", outbound);
        socket.emit("private_message", outbound);
        reply(callback, { ok: true, message: outbound });
      } catch (error) {
        reply(callback, {
          ok: false,
          error: error.message || "Không thể gửi tin nhắn."
        });
      }
    });

    socket.on("typing", async (payload = {}) => {
      const { conversationId, receiverId } = payload;
      if (!conversationId || !receiverId) return;

      const allowed = await conversationRepository.isParticipant(
        conversationId,
        user.id
      );
      if (!allowed) return;

      io.to(`user:${receiverId}`).emit("typing", {
        conversationId,
        senderId: user.id,
        senderName: user.displayName || user.username
      });
    });

    socket.on("stop_typing", async (payload = {}) => {
      const { conversationId, receiverId } = payload;
      if (!conversationId || !receiverId) return;

      const allowed = await conversationRepository.isParticipant(
        conversationId,
        user.id
      );
      if (!allowed) return;

      io.to(`user:${receiverId}`).emit("stop_typing", {
        conversationId,
        senderId: user.id
      });
    });

    socket.on("edit_message", async (payload = {}, callback) => {
      try {
        const messageId = payload.messageId;
        if (!messageId) {
          reply(callback, { ok: false, error: "Thiếu messageId." });
          return;
        }

        const message = await messageService.editMessage(
          user.id,
          messageId,
          payload.body ?? payload.message ?? payload.text
        );

        const outbound = { conversationId: message.conversationId, message };
        await realtimeService.emitToConversation(
          message.conversationId,
          "message_edited",
          outbound
        );
        reply(callback, { ok: true, message });
      } catch (error) {
        reply(callback, {
          ok: false,
          error: error.message || "Không thể chỉnh sửa tin nhắn."
        });
      }
    });

    socket.on("delete_message", async (payload = {}, callback) => {
      try {
        const messageId = payload.messageId;
        if (!messageId) {
          reply(callback, { ok: false, error: "Thiếu messageId." });
          return;
        }

        const message = await messageService.deleteMessage(user.id, messageId);
        const outbound = { conversationId: message.conversationId, message };
        await realtimeService.emitToConversation(
          message.conversationId,
          "message_deleted",
          outbound
        );
        reply(callback, { ok: true, message });
      } catch (error) {
        reply(callback, {
          ok: false,
          error: error.message || "Không thể xóa tin nhắn."
        });
      }
    });

    socket.on("add_reaction", async (payload = {}, callback) => {
      try {
        const { messageId, emoji } = payload;
        if (!messageId || !emoji) {
          reply(callback, { ok: false, error: "Thiếu messageId hoặc emoji." });
          return;
        }

        const message = await messageService.addReaction(
          user.id,
          messageId,
          emoji
        );
        const outbound = {
          conversationId: message.conversationId,
          messageId: message.id,
          emoji: emoji.trim(),
          userId: user.id,
          reactions: message.reactions
        };
        await realtimeService.emitToConversation(
          message.conversationId,
          "message_reaction_added",
          outbound
        );
        reply(callback, { ok: true, message });
      } catch (error) {
        reply(callback, {
          ok: false,
          error: error.message || "Không thể thêm reaction."
        });
      }
    });

    socket.on("remove_reaction", async (payload = {}, callback) => {
      try {
        const { messageId, emoji } = payload;
        if (!messageId || !emoji) {
          reply(callback, { ok: false, error: "Thiếu messageId hoặc emoji." });
          return;
        }

        const message = await messageService.removeReaction(
          user.id,
          messageId,
          emoji
        );
        const outbound = {
          conversationId: message.conversationId,
          messageId: message.id,
          emoji: emoji.trim(),
          userId: user.id,
          reactions: message.reactions
        };
        await realtimeService.emitToConversation(
          message.conversationId,
          "message_reaction_removed",
          outbound
        );
        reply(callback, { ok: true, message });
      } catch (error) {
        reply(callback, {
          ok: false,
          error: error.message || "Không thể gỡ reaction."
        });
      }
    });

    socket.on("mark_read", async (payload = {}, callback) => {
      try {
        const { conversationId, messageId } = payload;
        if (!conversationId || !messageId) {
          reply(callback, { ok: false, error: "Thiếu dữ liệu mark_read." });
          return;
        }

        const exists = await conversationRepository.conversationExists(
          conversationId
        );
        if (!exists) {
          reply(callback, { ok: false, error: "Hội thoại không tồn tại." });
          return;
        }

        const allowed = await conversationRepository.canAccessConversation(
          conversationId,
          user.id
        );
        if (!allowed) {
          reply(callback, { ok: false, error: "Không có quyền cập nhật đã đọc." });
          return;
        }

        const message = await messageRepository.findById(messageId);
        if (!message) {
          reply(callback, { ok: false, error: "Tin nhắn không tồn tại." });
          return;
        }

        if (message.conversationId !== conversationId) {
          reply(callback, {
            ok: false,
            error: "Tin nhắn không thuộc hội thoại này."
          });
          return;
        }

        await conversationRepository.markRead(
          conversationId,
          user.id,
          messageId
        );

        const otherUser = await conversationRepository.getOtherParticipant(
          conversationId,
          user.id
        );
        if (otherUser) {
          io.to(`user:${otherUser.id}`).emit("message_read", {
            conversationId,
            messageId,
            readerId: user.id
          });
        }

        reply(callback, { ok: true });
      } catch (error) {
        reply(callback, {
          ok: false,
          error: error.message || "Không thể cập nhật trạng thái đã đọc."
        });
      }
    });

    socket.on("disconnect", () => {
      const removedUser = presenceModel.removePresence(socket.id);
      if (!removedUser) return;
      io.emit("user_offline", removedUser);
      emitOnlineUsers(io);
    });
  });
}

module.exports = registerSocketController;