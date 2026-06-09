const assert = require("assert");
const http = require("http");
const { Server } = require("socket.io");
const { io: createClient } = require("socket.io-client");
const app = require("../src/app");
const registerSocketController = require("../src/controllers/socket.controller");

function waitForEvent(socket, eventName, predicate = () => true, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error(`Quá thời gian chờ sự kiện ${eventName}`));
    }, timeout);

    function handler(payload) {
      if (!predicate(payload)) {
        return;
      }

      clearTimeout(timer);
      socket.off(eventName, handler);
      resolve(payload);
    }

    socket.on(eventName, handler);
  });
}

function emitWithAck(socket, eventName, ...args) {
  return new Promise((resolve) => {
    socket.emit(eventName, ...args, resolve);
  });
}

async function run() {
  const httpServer = http.createServer(app);
  const io = new Server(httpServer);
  registerSocketController(io);

  await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const { port } = httpServer.address();
  const url = `http://127.0.0.1:${port}`;
  const clientA = createClient(url, { transports: ["websocket"] });
  const clientB = createClient(url, { transports: ["websocket"] });

  try {
    await Promise.all([
      waitForEvent(clientA, "connect"),
      waitForEvent(clientB, "connect")
    ]);

    const joinedA = await emitWithAck(clientA, "join_user", {
      username: "Lan",
      userId: "user-lan-a"
    });
    const joinedB = await emitWithAck(clientB, "join_user", {
      username: "Lan",
      userId: "user-lan-b"
    });

    assert.equal(joinedA.ok, true);
    assert.equal(joinedA.user.username, "Lan");
    assert.equal(joinedB.ok, true);
    assert.equal(joinedB.user.username, "Lan 2");

    const typingPromise = waitForEvent(
      clientB,
      "typing",
      (payload) => payload.senderId === joinedA.user.id
    );
    clientA.emit("typing", joinedB.user.id);
    const typing = await typingPromise;
    assert.equal(typing.senderName, "Lan");

    const receivedPromise = waitForEvent(
      clientB,
      "private_message",
      (message) => message.message === "Xin chào realtime"
    );
    const sentPromise = waitForEvent(
      clientA,
      "private_message",
      (message) => message.message === "Xin chào realtime"
    );
    const sentAck = await emitWithAck(clientA, "private_message", {
      receiverId: joinedB.user.id,
      message: "<b>Xin chào realtime</b>"
    });
    const [received, sent] = await Promise.all([
      receivedPromise,
      sentPromise
    ]);

    assert.equal(sentAck.ok, true);
    assert.equal(received.message, "Xin chào realtime");
    assert.equal(sent.id, received.id);

    const history = await emitWithAck(
      clientA,
      "load_messages",
      joinedB.user.id
    );
    assert.equal(history.ok, true);
    assert.equal(history.messages.length, 1);

    const offlinePromise = waitForEvent(
      clientA,
      "user_offline",
      (user) => user.socketId === joinedB.user.socketId
    );
    clientB.disconnect();
    const offlineUser = await offlinePromise;
    assert.equal(offlineUser.username, "Lan 2");

    console.log("Đã kiểm tra: tên trùng, typing, chat riêng, làm sạch nội dung, lịch sử và offline.");
  } finally {
    clientA.disconnect();
    clientB.disconnect();
    await new Promise((resolve) => io.close(resolve));
    await new Promise((resolve) => httpServer.close(resolve));
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
