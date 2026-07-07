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
const { getDatabaseError, closePool } = require("../src/db");
const {
  extractCookie,
  tokenFromCookie,
  waitForSocketConnect
} = require("./helpers/http");
const { fetchCsrf, csrfHeaders, mergeCookies } = require("./helpers/csrf");

function emitWithAck(socket, eventName, payload = {}) {
  return new Promise((resolve) => {
    socket.emit(eventName, payload, resolve);
  });
}

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

async function registerUser(baseUrl, username, email) {
  const password = "secret12345";
  const csrf = await fetchCsrf(baseUrl);
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: csrfHeaders(csrf.token, csrf.cookie),
    body: JSON.stringify({
      username,
      email,
      password,
      confirmPassword: password
    })
  });
  const data = await response.json();
  assert.equal(data.ok, true, data.error);
  const authCookie = extractCookie(response);
  const csrfToken = data.csrfToken || csrf.token;
  return {
    user: data.user,
    authCookie,
    apiCookie: mergeCookies(authCookie, `notket_csrf=${csrfToken}`),
    csrfToken
  };
}

async function run() {
  if (getDatabaseError()) {
    console.log("Bỏ qua conversations API test vì thiếu DATABASE_URL.");
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
  const userA = await registerUser(
    baseUrl,
    `conv_a_${stamp}`,
    `conv_a_${stamp}@test.local`
  );
  const userB = await registerUser(
    baseUrl,
    `conv_b_${stamp}`,
    `conv_b_${stamp}@test.local`
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

  try {
    await Promise.all([
      waitForSocketConnect(clientA),
      waitForSocketConnect(clientB)
    ]);

    const joinedA = await emitWithAck(clientA, "join_chat");
    const joinedB = await emitWithAck(clientB, "join_chat");
    assert.equal(joinedA.ok, true);
    assert.equal(joinedB.ok, true);
    assert.ok(joinedA.publicRoom?.id);

    const publicRoom = await fetch(`${baseUrl}/api/conversations/public`, {
      headers: { Cookie: userA.apiCookie }
    });
    const publicData = await publicRoom.json();
    assert.equal(publicData.ok, true);
    assert.equal(publicData.room.type, "public");

    const publicPromise = waitForEvent(
      clientB,
      "public_message",
      (message) => message.message === "Xin chào phòng chung"
    );
    const publicSent = await emitWithAck(clientA, "public_message", {
      conversationId: joinedA.publicRoom.id,
      type: "text",
      message: "Xin chào phòng chung"
    });
    const publicReceived = await publicPromise;
    assert.equal(publicSent.ok, true);
    assert.equal(publicReceived.conversationId, joinedA.publicRoom.id);

    const createGroup = await fetch(`${baseUrl}/api/conversations/groups`, {
      method: "POST",
      headers: csrfHeaders(userA.csrfToken, userA.apiCookie),
      body: JSON.stringify({
        name: "Nhóm test",
        memberIds: [userB.user.id]
      })
    });
    const groupData = await createGroup.json();
    assert.equal(groupData.ok, true, groupData.error);
    const groupId = groupData.group.id;

    await emitWithAck(clientB, "join_conversation", {
      conversationId: groupId
    });

    const groupPromise = waitForEvent(
      clientB,
      "group_message",
      (message) => message.message === "Tin nhắn nhóm"
    );
    const groupSent = await emitWithAck(clientA, "group_message", {
      conversationId: groupId,
      type: "text",
      message: "Tin nhắn nhóm"
    });
    const groupReceived = await groupPromise;
    assert.equal(groupSent.ok, true);
    assert.equal(groupReceived.conversationId, groupId);

    const groups = await fetch(`${baseUrl}/api/conversations/groups`, {
      headers: { Cookie: userB.apiCookie }
    });
    const groupsData = await groups.json();
    assert.equal(groupsData.ok, true);
    assert.ok(groupsData.groups.some((item) => item.conversationId === groupId));

    console.log("Đã kiểm tra: public room, public_message, group CRUD, group_message.");
  } finally {
    clientA.disconnect();
    clientB.disconnect();
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