process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-secret-key-32chars-minimum!";

const assert = require("assert");
const http = require("http");
const { Server } = require("socket.io");
const { io: createClient } = require("socket.io-client");
const app = require("../src/app");
const registerSocketController = require("../src/controllers/socket.controller");
const realtimeService = require("../src/services/realtime.service");
const { socketAuthMiddleware } = require("../src/middlewares/socket-auth.middleware");
const uploadModel = require("../src/models/upload.model");
const storageService = require("../src/services/storage.service");

const originalVerifyUploadedObject = storageService.verifyUploadedObject;
const originalResolveFileUrl = storageService.resolveFileUrl;
const originalVerifyContent = storageService.verifyUploadedObjectContent;

storageService.verifyUploadedObject = async () => true;
storageService.verifyUploadedObjectContent = async () => true;
storageService.resolveFileUrl = async (fileKey) =>
  `https://storage.test/${fileKey}`;
const { getDatabaseError, closePool } = require("../src/db");
const {
  extractCookie,
  tokenFromCookie,
  waitForSocketConnect
} = require("./helpers/http");
const { fetchCsrf, csrfHeaders } = require("./helpers/csrf");

function waitForEvent(socket, eventName, predicate = () => true, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error(`Quá thời gian chờ sự kiện ${eventName}`));
    }, timeout);

    function handler(payload) {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(eventName, handler);
      resolve(payload);
    }

    socket.on(eventName, handler);
  });
}

function closeWithTimeout(closer, timeoutMs = 3000) {
  return Promise.race([
    new Promise((resolve) => closer(resolve)),
    new Promise((resolve) => setTimeout(resolve, timeoutMs))
  ]);
}

function emitWithAck(socket, eventName, ...args) {
  return new Promise((resolve) => {
    if (args.length === 0) {
      socket.emit(eventName, {}, resolve);
      return;
    }
    socket.emit(eventName, ...args, resolve);
  });
}

async function registerUser(serverUrl, username, email) {
  const password = "secret12345";
  const csrf = await fetchCsrf(serverUrl);
  const registerResponse = await fetch(`${serverUrl}/api/auth/register`, {
    method: "POST",
    headers: csrfHeaders(csrf.token, csrf.cookie),
    body: JSON.stringify({
      username,
      email,
      password,
      confirmPassword: password
    })
  });
  const registerData = await registerResponse.json();
  assert.equal(registerData.ok, true, registerData.error);
  return {
    user: registerData.user,
    cookie: extractCookie(registerResponse)
  };
}

async function run() {
  const guard = setTimeout(() => {
    console.error("Socket integration test timeout sau 45 giây.");
    process.exit(1);
  }, 45000);

  if (getDatabaseError()) {
    clearTimeout(guard);
    console.log("Bỏ qua socket integration DB test vì thiếu DATABASE_URL.");
    return;
  }

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, { cors: { origin: true, credentials: true } });
  io.use(socketAuthMiddleware);
  realtimeService.setIo(io);
  registerSocketController(io);

  await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const { port } = httpServer.address();
  const url = `http://127.0.0.1:${port}`;

  const stamp = Date.now();
  const userA = await registerUser(url, `user_a_${stamp}`, `a_${stamp}@test.local`);
  const userB = await registerUser(url, `user_b_${stamp}`, `b_${stamp}@test.local`);

  assert.ok(userA.cookie, "Thiếu cookie sau register user A.");
  assert.ok(userB.cookie, "Thiếu cookie sau register user B.");

  const clientA = createClient(url, {
    transports: ["websocket"],
    reconnection: false,
    auth: { token: tokenFromCookie(userA.cookie) }
  });
  const clientB = createClient(url, {
    transports: ["websocket"],
    reconnection: false,
    auth: { token: tokenFromCookie(userB.cookie) }
  });
  let clientC = null;

  try {
    await Promise.all([
      waitForSocketConnect(clientA),
      waitForSocketConnect(clientB)
    ]);
    const joinedA = await emitWithAck(clientA, "join_chat");
    const joinedB = await emitWithAck(clientB, "join_chat");
    assert.equal(joinedA.ok, true);
    assert.equal(joinedA.user.id, userA.user.id);
    assert.equal(joinedB.ok, true);

    const receivedPromise = waitForEvent(
      clientB,
      "private_message",
      (message) => message.message === "Xin chào realtime DB"
    );
    const sentAck = await emitWithAck(clientA, "private_message", {
      receiverId: userB.user.id,
      type: "text",
      message: "Xin chào realtime DB"
    });
    const received = await receivedPromise;
    assert.equal(sentAck.ok, true);
    assert.equal(sentAck.message.type, "text");
    assert.ok(sentAck.message.conversationId);
    assert.equal(received.conversationId, sentAck.message.conversationId);

    const history = await emitWithAck(clientB, "load_messages", {
      conversationId: sentAck.message.conversationId,
      limit: 30
    });
    assert.equal(history.ok, true);
    assert.equal(history.messages.length, 1);

    const emptyText = await emitWithAck(clientA, "private_message", {
      receiverId: userB.user.id,
      conversationId: sentAck.message.conversationId,
      type: "text",
      message: "   "
    });
    assert.equal(emptyText.ok, false);

    const noPending = await emitWithAck(clientA, "private_message", {
      receiverId: userB.user.id,
      type: "image",
      fileUrl: "https://example.com/demo.png",
      fileKey: "chats/fake/demo.png",
      fileName: "demo.png",
      mimeType: "image/png",
      size: 1024
    });
    assert.equal(noPending.ok, false);

    const fileMeta = {
      kind: "image",
      fileUrl: "https://example.com/demo.png",
      fileKey: `chats/${userA.user.id}/2026/07/demo.png`,
      fileName: "demo.png",
      mimeType: "image/png",
      size: 2048
    };
    uploadModel.addPendingUpload(userA.user.id, fileMeta);
    const imageAck = await emitWithAck(clientA, "private_message", {
      receiverId: userB.user.id,
      conversationId: sentAck.message.conversationId,
      type: "image",
      ...fileMeta,
      size: fileMeta.size
    });
    assert.equal(imageAck.ok, true);
    assert.equal(imageAck.message.type, "image");

    const historyAfterImage = await emitWithAck(clientA, "load_messages", {
      conversationId: sentAck.message.conversationId,
      limit: 30
    });
    assert.equal(historyAfterImage.messages.length, 2);

    const wrongReceiver = await emitWithAck(clientA, "private_message", {
      conversationId: sentAck.message.conversationId,
      receiverId: userA.user.id,
      type: "text",
      message: "Sai người nhận"
    });
    assert.equal(wrongReceiver.ok, false);

    const markReadOk = await emitWithAck(clientB, "mark_read", {
      conversationId: sentAck.message.conversationId,
      messageId: sentAck.message.id
    });
    assert.equal(markReadOk.ok, true);

    const fakeMessageId = "00000000-0000-0000-0000-000000000099";
    const markReadFake = await emitWithAck(clientB, "mark_read", {
      conversationId: sentAck.message.conversationId,
      messageId: fakeMessageId
    });
    assert.equal(markReadFake.ok, false);

    const stampB = Date.now();
    const userC = await registerUser(
      url,
      `user_c_${stampB}`,
      `c_${stampB}@test.local`
    );
    clientC = createClient(url, {
      transports: ["websocket"],
      reconnection: false,
      auth: { token: tokenFromCookie(userC.cookie) }
    });
    await waitForSocketConnect(clientC);
    await emitWithAck(clientC, "join_chat");

    const sentC = await emitWithAck(clientC, "private_message", {
      receiverId: userA.user.id,
      type: "text",
      message: "Hội thoại khác"
    });
    assert.equal(sentC.ok, true);

    const markReadWrongConv = await emitWithAck(clientB, "mark_read", {
      conversationId: sentC.message.conversationId,
      messageId: sentAck.message.id
    });
    assert.equal(markReadWrongConv.ok, false);

    if (clientC) {
      clientC.disconnect();
      clientC = null;
    }

    const conversationRepository = require("../src/repositories/conversation.repository");
    const raceResults = await Promise.all(
      Array.from({ length: 5 }, () =>
        conversationRepository.findOrCreateDirectConversation(
          userA.user.id,
          userB.user.id
        )
      )
    );
    assert.ok(
      raceResults.every((id) => id === raceResults[0]),
      "Race findOrCreateDirectConversation phải trả cùng conversationId"
    );

    console.log(
      "Đã kiểm tra: auth socket, text/image DB, load history, reject fake upload, mark_read, race conversation."
    );
  } finally {
    storageService.verifyUploadedObject = originalVerifyUploadedObject;
    storageService.verifyUploadedObjectContent = originalVerifyContent;
    storageService.resolveFileUrl = originalResolveFileUrl;
    clearTimeout(guard);
    clientA.disconnect();
    clientB.disconnect();
    if (clientC) {
      clientC.disconnect();
    }
    io.removeAllListeners();
    await closeWithTimeout((resolve) => io.close(resolve));
    await closeWithTimeout((resolve) => httpServer.close(resolve));
    await closePool();
  }
}

run()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });