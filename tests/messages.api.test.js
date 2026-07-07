process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-secret-key-32chars-minimum!";

const assert = require("assert");
const http = require("http");
const { Server } = require("socket.io");
const { io: createClient } = require("socket.io-client");
const app = require("../src/app");
const registerSocketController = require("../src/controllers/socket.controller");
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
    ...sessionFromAuthResponse(response, data),
    password
  };
}

async function run() {
  if (getDatabaseError()) {
    console.log("Bỏ qua messages API test vì thiếu DATABASE_URL.");
    return;
  }

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, { cors: { origin: true, credentials: true } });
  io.use(socketAuthMiddleware);
  registerSocketController(io);

  await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const { port } = httpServer.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const stamp = Date.now();
  const userA = await registerUser(
    baseUrl,
    `msg_a_${stamp}`,
    `msg_a_${stamp}@test.local`
  );
  const userB = await registerUser(
    baseUrl,
    `msg_b_${stamp}`,
    `msg_b_${stamp}@test.local`
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
    await emitWithAck(clientA, "join_chat");
    await emitWithAck(clientB, "join_chat");

    const sent = await emitWithAck(clientA, "private_message", {
      receiverId: userB.user.id,
      type: "text",
      message: "Tin nhắn để edit và search"
    });
    assert.equal(sent.ok, true, sent.error);
    const conversationId = sent.message.conversationId;
    const messageId = sent.message.id;

    const edit = await fetch(`${baseUrl}/api/messages/${messageId}`, {
      method: "PATCH",
      headers: csrfHeaders(userA.csrfToken, userA.apiCookie),
      body: JSON.stringify({ body: "Tin nhắn đã chỉnh sửa" })
    });
    const editData = await edit.json();
    assert.equal(editData.ok, true, editData.error);
    assert.equal(editData.message.isEdited, true);
    assert.equal(editData.message.body, "Tin nhắn đã chỉnh sửa");

    const forbiddenEdit = await fetch(`${baseUrl}/api/messages/${messageId}`, {
      method: "PATCH",
      headers: csrfHeaders(userB.csrfToken, userB.apiCookie),
      body: JSON.stringify({ body: "Hack edit" })
    });
    const forbiddenEditData = await forbiddenEdit.json();
    assert.equal(forbiddenEditData.ok, false);

    const addReaction = await fetch(`${baseUrl}/api/messages/${messageId}/reactions`, {
      method: "POST",
      headers: csrfHeaders(userB.csrfToken, userB.apiCookie),
      body: JSON.stringify({ emoji: "👍" })
    });
    const reactionData = await addReaction.json();
    assert.equal(reactionData.ok, true, reactionData.error);
    assert.ok(
      reactionData.message.reactions.some(
        (item) => item.emoji === "👍" && item.userId === userB.user.id
      )
    );

    const removeReaction = await fetch(
      `${baseUrl}/api/messages/${messageId}/reactions`,
      {
        method: "DELETE",
        headers: csrfHeaders(userB.csrfToken, userB.apiCookie),
        body: JSON.stringify({ emoji: "👍" })
      }
    );
    const removeData = await removeReaction.json();
    assert.equal(removeData.ok, true, removeData.error);
    assert.equal(removeData.message.reactions.length, 0);

    const search = await fetch(
      `${baseUrl}/api/messages/search?conversationId=${conversationId}&q=chỉnh+sửa`,
      { headers: { Cookie: userA.apiCookie } }
    );
    const searchData = await search.json();
    assert.equal(searchData.ok, true, searchData.error);
    assert.ok(searchData.messages.some((item) => item.id === messageId));

    const sentDelete = await emitWithAck(clientA, "private_message", {
      receiverId: userB.user.id,
      conversationId,
      type: "text",
      message: "Tin nhắn sẽ bị xóa"
    });
    assert.equal(sentDelete.ok, true);

    const deleted = await fetch(
      `${baseUrl}/api/messages/${sentDelete.message.id}`,
      {
        method: "DELETE",
        headers: csrfHeaders(userA.csrfToken, userA.apiCookie)
      }
    );
    const deletedData = await deleted.json();
    assert.equal(deletedData.ok, true, deletedData.error);
    assert.equal(deletedData.message.isDeleted, true);

    const replySent = await emitWithAck(clientA, "private_message", {
      receiverId: userB.user.id,
      conversationId,
      type: "text",
      message: "Trả lời tin nhắn",
      replyToMessageId: messageId
    });
    assert.equal(replySent.ok, true, replySent.error);
    assert.equal(replySent.message.replyToMessageId, messageId);

    const conversations = await emitWithAck(clientB, "load_conversations");
    assert.equal(conversations.ok, true);
    const conv = conversations.conversations.find(
      (item) => item.conversationId === conversationId
    );
    assert.ok(conv);
    assert.equal(typeof conv.unreadCount, "number");

    console.log(
      "Đã kiểm tra: edit/delete message API, reactions, search, reply, unread count."
    );
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