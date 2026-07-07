process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-secret-key-32chars-minimum!";

const assert = require("assert");
const http = require("http");
const { Server } = require("socket.io");
const { io: createClient } = require("socket.io-client");
const app = require("../src/app");
const registerSocketController = require("../src/controllers/socket.controller");
const realtimeService = require("../src/services/realtime.service");
const conversationRepository = require("../src/repositories/conversation.repository");
const { socketAuthMiddleware } = require("../src/middlewares/socket-auth.middleware");
const { getDatabaseError, closePool } = require("../src/db");
const {
  extractCookie,
  tokenFromCookie,
  waitForSocketConnect
} = require("./helpers/http");
const { fetchCsrf, csrfHeaders } = require("./helpers/csrf");

async function registerUser(baseUrl, username) {
  const password = "secret12345";
  const csrf = await fetchCsrf(baseUrl);
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: csrfHeaders(csrf.token, csrf.cookie),
    body: JSON.stringify({
      username,
      email: `${username}@test.local`,
      password,
      confirmPassword: password
    })
  });
  const data = await response.json();
  assert.equal(data.ok, true, data.error);
  return {
    user: data.user,
    authCookie: extractCookie(response)
  };
}

function emitWithAck(socket, eventName, payload = {}) {
  return new Promise((resolve) => {
    socket.emit(eventName, payload, resolve);
  });
}

function waitForEvent(socket, eventName, predicate = () => true, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error(`Timeout chờ ${eventName}`));
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

async function run() {
  if (getDatabaseError()) {
    console.log("Bỏ qua socket typing test vì thiếu DATABASE_URL.");
    return;
  }

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, { cors: { origin: true, credentials: true } });
  io.use(socketAuthMiddleware);
  realtimeService.setIo(io);
  registerSocketController(io);

  await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const { port } = httpServer.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const stamp = Date.now();

  const userA = await registerUser(baseUrl, `typing_a_${stamp}`);
  const userB = await registerUser(baseUrl, `typing_b_${stamp}`);
  const userC = await registerUser(baseUrl, `typing_c_${stamp}`);

  const conversationId =
    await conversationRepository.findOrCreateDirectConversation(
      userA.user.id,
      userB.user.id
    );

  const clientA = createClient(baseUrl, {
    transports: ["websocket"],
    reconnection: false,
    auth: { token: tokenFromCookie(userA.authCookie) }
  });
  const clientB = createClient(baseUrl, {
    transports: ["websocket"],
    reconnection: false,
    auth: { token: tokenFromCookie(userB.authCookie) }
  });
  const clientC = createClient(baseUrl, {
    transports: ["websocket"],
    reconnection: false,
    auth: { token: tokenFromCookie(userC.authCookie) }
  });

  try {
    await Promise.all([
      waitForSocketConnect(clientA),
      waitForSocketConnect(clientB),
      waitForSocketConnect(clientC)
    ]);

    await emitWithAck(clientA, "join_conversation", { conversationId });
    await emitWithAck(clientB, "join_conversation", { conversationId });

    const typingPromise = waitForEvent(
      clientB,
      "typing",
      (payload) =>
        payload.conversationId === conversationId &&
        payload.senderId === userA.user.id
    );

    let cReceived = false;
    clientC.on("typing", () => {
      cReceived = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    clientA.emit("typing", {
      conversationId,
      receiverId: userC.user.id
    });

    const typingPayload = await typingPromise;
    assert.equal(typingPayload.senderId, userA.user.id);
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(cReceived, false, "Spoof receiverId không được leak typing");

    console.log("Đã kiểm tra typing authorization chống receiverId spoof.");
  } finally {
    clientA.disconnect();
    clientB.disconnect();
    clientC.disconnect();
    io.removeAllListeners();
    await new Promise((resolve) => io.close(resolve));
    await new Promise((resolve) => httpServer.close(resolve));
    await closePool();
  }
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });