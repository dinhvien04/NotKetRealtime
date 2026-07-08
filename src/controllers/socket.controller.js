const presenceService = require("../services/presence.service");
const messageModel = require("../models/message.model");
const { buildVerifiedFileMessagePayload } = require("../services/file-message.service");
const conversationRepository = require("../repositories/conversation.repository");
const messageRepository = require("../repositories/message.repository");
const userRepository = require("../repositories/user.repository");
const messageService = require("../services/message.service");
const conversationMessageService = require("../services/conversation-message.service");
const realtimeService = require("../services/realtime.service");
const rateLimitService = require("../services/rate-limit.service");
const { sanitizeMessage } = require("../utils/sanitize");
const { assertValidUuid } = require("../utils/validation");

async function emitOnlineUsers(io) {
  const users = await presenceService.getAllOnline();
  io.emit("online_users", users);
}

function reply(callback, payload) {
  if (typeof callback === "function") {
    callback(payload);
  }
}

function getSocketUser(socket) {
  return socket.data.user || null;
}

function guardSocketRateLimit(user, event, callback) {
  const result = rateLimitService.checkRateLimit(user.id, event);
  if (!result.allowed) {
    reply(callback, { ok: false, error: result.error });
    return false;
  }
  return true;
}

function registerSocketController(io) {
  io.on("connection", async (socket) => {
    const user = getSocketUser(socket);
    if (!user) {
      socket.disconnect(true);
      return;
    }

    await presenceService.addPresence(socket.id, user);
    socket.join(`user:${user.id}`);
    await emitOnlineUsers(io);

    socket.on("join_chat", async (_payload, callback) => {
      try {
        const publicRoom = await conversationRepository.ensurePublicParticipant(
          user.id
        );
        socket.join(`conversation:${publicRoom.id}`);
        reply(callback, { ok: true, user, publicRoom });
        await emitOnlineUsers(io);
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
      if (!guardSocketRateLimit(user, "load_messages", callback)) {
        return;
      }

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

        try {
          assertValidUuid(conversationId, "conversationId");
        } catch (error) {
          reply(callback, {
            ok: false,
            error: error.message,
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
      const rateEvent = expectedType === "public" ? "public_message" : "group_message";
      if (!guardSocketRateLimit(user, rateEvent, callback)) {
        return;
      }

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
      if (!guardSocketRateLimit(user, "private_message", callback)) {
        return;
      }

      const messageType = payload.type || "text";

      try {
        let conversationId;
        let receiverId;

        if (payload.conversationId) {
          conversationId = payload.conversationId;

          try {
            assertValidUuid(conversationId, "conversationId");
          } catch (error) {
            reply(callback, { ok: false, error: error.message });
            return;
          }

          const conversation = await conversationRepository.getById(conversationId);
          if (!conversation || conversation.type !== "direct") {
            reply(callback, {
              ok: false,
              error: "Hội thoại không hợp lệ cho chat riêng."
            });
            return;
          }

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

          try {
            assertValidUuid(receiverId, "receiverId");
          } catch (error) {
            reply(callback, { ok: false, error: error.message });
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
          try {
            messagePayload = await buildVerifiedFileMessagePayload(user, payload);
          } catch (error) {
            reply(callback, {
              ok: false,
              error: error.message || "File chưa upload xong hoặc metadata không khớp."
            });
            return;
          }
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
          payload: {
            ...messagePayload,
            actorRole: user.role || "user"
          }
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

    async function handleTypingEvent(payload = {}, isTyping) {
      if (isTyping && !guardSocketRateLimit(user, "typing", null)) {
        return;
      }

      const { conversationId } = payload;
      if (!conversationId) return;

      try {
        assertValidUuid(conversationId, "conversationId");
      } catch (_error) {
        return;
      }

      const conversation = await conversationRepository.getById(conversationId);
      if (!conversation) return;

      const allowed = await conversationRepository.isParticipant(
        conversationId,
        user.id
      );
      if (!allowed) return;

      const eventName = isTyping ? "typing" : "stop_typing";
      const eventPayload = {
        conversationId,
        senderId: user.id,
        ...(isTyping
          ? { senderName: user.displayName || user.username }
          : {})
      };

      if (conversation.type === "direct") {
        const receiver = await conversationRepository.getOtherParticipant(
          conversationId,
          user.id
        );
        if (!receiver) return;

        io.to(`user:${receiver.id}`).emit(eventName, eventPayload);
        return;
      }

      if (conversation.type === "group") {
        socket
          .to(`conversation:${conversationId}`)
          .emit(eventName, eventPayload);
        return;
      }

      if (conversation.type === "public") {
        socket
          .to(`conversation:${conversationId}`)
          .emit(eventName, eventPayload);
      }
    }

    socket.on("typing", async (payload = {}) => {
      await handleTypingEvent(payload, true);
    });

    socket.on("stop_typing", async (payload = {}) => {
      await handleTypingEvent(payload, false);
    });

    socket.on("edit_message", async (payload = {}, callback) => {
      if (!guardSocketRateLimit(user, "edit_message", callback)) {
        return;
      }

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
      if (!guardSocketRateLimit(user, "delete_message", callback)) {
        return;
      }

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
      if (!guardSocketRateLimit(user, "add_reaction", callback)) {
        return;
      }

      try {
        const { messageId } = payload;
        const reactionPayload = {
          emoji: payload.emoji,
          reactionType: payload.reactionType,
          value: payload.value,
          color: payload.color
        };
        if (!messageId || (!reactionPayload.emoji && !reactionPayload.value)) {
          reply(callback, { ok: false, error: "Thiếu messageId hoặc reaction." });
          return;
        }

        const message = await messageService.addReaction(
          user.id,
          messageId,
          reactionPayload
        );
        const reactionType = reactionPayload.reactionType || (reactionPayload.emoji ? "emoji" : "icon");
        const value = reactionPayload.value || reactionPayload.emoji;
        const outbound = {
          conversationId: message.conversationId,
          messageId: message.id,
          emoji: reactionType === "emoji" ? String(value || "").trim() : undefined,
          reactionType,
          value: String(value || "").trim(),
          color: reactionType === "icon" ? reactionPayload.color || null : null,
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
      if (!guardSocketRateLimit(user, "remove_reaction", callback)) {
        return;
      }

      try {
        const { messageId } = payload;
        const reactionPayload = {
          emoji: payload.emoji,
          reactionType: payload.reactionType,
          value: payload.value,
          color: payload.color
        };
        if (!messageId || (!reactionPayload.emoji && !reactionPayload.value)) {
          reply(callback, { ok: false, error: "Thiếu messageId hoặc reaction." });
          return;
        }

        const message = await messageService.removeReaction(
          user.id,
          messageId,
          reactionPayload
        );
        const reactionType = reactionPayload.reactionType || (reactionPayload.emoji ? "emoji" : "icon");
        const value = reactionPayload.value || reactionPayload.emoji;
        const outbound = {
          conversationId: message.conversationId,
          messageId: message.id,
          emoji: reactionType === "emoji" ? String(value || "").trim() : undefined,
          reactionType,
          value: String(value || "").trim(),
          color: reactionType === "icon" ? reactionPayload.color || null : null,
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
      if (!guardSocketRateLimit(user, "mark_read", callback)) {
        return;
      }

      try {
        const { conversationId, messageId } = payload;
        if (!conversationId || !messageId) {
          reply(callback, { ok: false, error: "Thiếu dữ liệu mark_read." });
          return;
        }

        try {
          assertValidUuid(conversationId, "conversationId");
          assertValidUuid(messageId, "messageId");
        } catch (error) {
          reply(callback, { ok: false, error: error.message });
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

    socket.on("disconnect", async () => {
      const removedUser = await presenceService.removePresence(socket.id);
      if (!removedUser) return;
      io.emit("user_offline", removedUser);
      await emitOnlineUsers(io);
    });
  });
}

module.exports = registerSocketController;