process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-secret-key-32chars-minimum!";

const assert = require("assert");
const http = require("http");
const { Server } = require("socket.io");
const { io: createClient } = require("socket.io-client");
const app = require("../src/app");
const registerSocketController = require("../src/controllers/socket.controller");
const realtimeService = require("../src/services/realtime.service");
const badWordService = require("../src/services/bad-word.service");
const userRepository = require("../src/repositories/user.repository");
const { socketAuthMiddleware } = require("../src/middlewares/socket-auth.middleware");
const { getDatabaseError, closePool } = require("../src/db");
const {
  extractCookie,
  tokenFromCookie,
  waitForSocketConnect
} = require("./helpers/http");
const { fetchCsrf, csrfHeaders, sessionFromAuthResponse } = require("./helpers/csrf");

function emitWithAck(socket, eventName, payload = {}) {
  return new Promise((resolve) => {
    socket.emit(eventName, payload, resolve);
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
  return {
    user: data.user,
    ...sessionFromAuthResponse(response, data)
  };
}

async function run() {
  if (getDatabaseError()) {
    console.log("Bỏ qua admin API test vì thiếu DATABASE_URL.");
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
  const adminUser = await registerUser(
    baseUrl,
    `admin_${stamp}`,
    `admin_${stamp}@test.local`
  );
  const normalUser = await registerUser(
    baseUrl,
    `user_${stamp}`,
    `user_${stamp}@test.local`
  );

  await userRepository.setRole(adminUser.user.id, "admin");

  const client = createClient(baseUrl, {
    transports: ["websocket"],
    reconnection: false,
    auth: { token: tokenFromCookie(adminUser.authCookie) }
  });

  try {
    const forbidden = await fetch(`${baseUrl}/api/admin/stats`, {
      headers: { Cookie: normalUser.apiCookie }
    });
    assert.equal(forbidden.status, 403);

    const stats = await fetch(`${baseUrl}/api/admin/stats`, {
      headers: { Cookie: adminUser.apiCookie }
    });
    const statsData = await stats.json();
    assert.equal(statsData.ok, true);
    assert.ok(statsData.stats.totalUsers >= 2);

    const createWord = await fetch(`${baseUrl}/api/admin/bad-words`, {
      method: "POST",
      headers: csrfHeaders(adminUser.csrfToken, adminUser.apiCookie),
      body: JSON.stringify({
        word: `badword${stamp}`,
        severity: "low"
      })
    });
    const wordData = await createWord.json();
    assert.equal(wordData.ok, true, wordData.error);

    await badWordService.refreshCache(true);

    await waitForSocketConnect(client);
    await emitWithAck(client, "join_chat");

    const sent = await emitWithAck(client, "private_message", {
      receiverId: normalUser.user.id,
      type: "text",
      message: `Tin nhắn có badword${stamp} trong đó`
    });
    assert.equal(sent.ok, true);
    assert.ok(sent.message.message.includes("***"));

    const audit = await fetch(`${baseUrl}/api/admin/audit-logs`, {
      headers: { Cookie: adminUser.apiCookie }
    });
    const auditData = await audit.json();
    assert.equal(auditData.ok, true);
    assert.ok(auditData.items.some((item) => item.action === "bad_word.create"));

    const lockUser = await fetch(`${baseUrl}/api/admin/users/${normalUser.user.id}`, {
      method: "PATCH",
      headers: csrfHeaders(adminUser.csrfToken, adminUser.apiCookie),
      body: JSON.stringify({ isLocked: true, lockedReason: "Test lock" })
    });
    const lockData = await lockUser.json();
    assert.equal(lockData.ok, true);
    assert.equal(lockData.user.isLocked, true);

    const deleteMessage = await fetch(
      `${baseUrl}/api/admin/messages/${sent.message.id}`,
      {
        method: "DELETE",
        headers: csrfHeaders(adminUser.csrfToken, adminUser.apiCookie)
      }
    );
    const deleteData = await deleteMessage.json();
    assert.equal(deleteData.ok, true);

    console.log(
      "Đã kiểm tra: admin stats, bad-word CRUD/filter, lock user, admin delete, audit logs."
    );
  } finally {
    client.disconnect();
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