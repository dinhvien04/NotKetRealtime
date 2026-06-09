const userModel = require("../models/user.model");
const messageModel = require("../models/message.model");
const { sanitizeMessage, sanitizeUsername } = require("../utils/sanitize");

function emitOnlineUsers(io) {
  io.emit("online_users", userModel.getAllUsers());
}

function reply(callback, payload) {
  if (typeof callback === "function") {
    callback(payload);
  }
}

function registerSocketController(io) {
  io.on("connection", (socket) => {
    socket.on("join_user", (payload, callback) => {
      const rawUsername =
        typeof payload === "string" ? payload : payload?.username;
      const requestedUserId =
        typeof payload === "object" ? sanitizeUsername(payload?.userId) : "";
      const username = sanitizeUsername(rawUsername);

      if (!username) {
        reply(callback, {
          ok: false,
          error: "Vui lòng nhập tên người dùng."
        });
        return;
      }

      if (userModel.getUser(socket.id)) {
        reply(callback, {
          ok: false,
          error: "Bạn đã tham gia phòng chat."
        });
        return;
      }

      const user = userModel.addUser(
        socket.id,
        username,
        requestedUserId || socket.id
      );
      reply(callback, { ok: true, user });
      emitOnlineUsers(io);
    });

    socket.on("load_messages", (receiverId, callback) => {
      const sender = userModel.getUser(socket.id);
      const receiver = userModel.findUserById(receiverId);

      if (!sender || !receiver) {
        reply(callback, {
          ok: false,
          error: "Người dùng này hiện không trực tuyến.",
          messages: []
        });
        return;
      }

      reply(callback, {
        ok: true,
        messages: messageModel.getMessagesBetweenUsers(sender.id, receiver.id)
      });
    });

    socket.on("private_message", (payload = {}, callback) => {
      const sender = userModel.getUser(socket.id);
      const receiver = userModel.findUserById(payload.receiverId);
      const content = sanitizeMessage(payload.message);

      if (!sender) {
        reply(callback, {
          ok: false,
          error: "Phiên trò chuyện không hợp lệ. Vui lòng tham gia lại."
        });
        return;
      }

      if (!content) {
        reply(callback, {
          ok: false,
          error: "Không thể gửi tin nhắn trống."
        });
        return;
      }

      if (!receiver) {
        reply(callback, {
          ok: false,
          error: "Người nhận đã ngoại tuyến."
        });
        return;
      }

      const message = messageModel.createMessage(
        sender.id,
        receiver.id,
        sender.username,
        content
      );

      io.to(receiver.socketId).emit("private_message", message);
      socket.emit("private_message", message);
      reply(callback, { ok: true, message });
    });

    socket.on("typing", (receiverId) => {
      const sender = userModel.getUser(socket.id);
      const receiver = userModel.findUserById(receiverId);
      if (sender && receiver) {
        io.to(receiver.socketId).emit("typing", {
          senderId: sender.id,
          senderName: sender.username
        });
      }
    });

    socket.on("stop_typing", (receiverId) => {
      const receiver = userModel.findUserById(receiverId);
      const sender = userModel.getUser(socket.id);
      if (receiver && sender) {
        io.to(receiver.socketId).emit("stop_typing", {
          senderId: sender.id
        });
      }
    });

    socket.on("disconnect", () => {
      const removedUser = userModel.removeUser(socket.id);
      if (!removedUser) {
        return;
      }

      io.emit("user_offline", removedUser);
      emitOnlineUsers(io);
    });
  });
}

module.exports = registerSocketController;
