process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-secret-key-32chars-minimum!";

const assert = require("assert");
const http = require("http");
const app = require("../src/app");
const conversationRepository = require("../src/repositories/conversation.repository");
const userRepository = require("../src/repositories/user.repository");
const { getDatabaseError, closePool, query } = require("../src/db");
const { fetchCsrf, csrfHeaders, mergeCookies } = require("./helpers/csrf");
const { extractCookie } = require("./helpers/http");
const argon2 = require("argon2");

async function createUser(username) {
  const passwordHash = await argon2.hash("secret12345", {
    type: argon2.argon2id
  });
  return userRepository.createUser({
    username,
    email: `${username}@test.local`,
    passwordHash,
    displayName: username
  });
}

async function registerViaApi(baseUrl, username) {
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
  const authCookie = extractCookie(response);
  const csrfToken = data.csrfToken;
  return {
    user: data.user,
    cookie: mergeCookies(authCookie, `notket_csrf=${csrfToken}`),
    csrfToken
  };
}

async function run() {
  if (getDatabaseError()) {
    console.log("Bỏ qua group roles test vì thiếu DATABASE_URL.");
    return;
  }

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const stamp = Date.now();

  const owner = await registerViaApi(baseUrl, `owner_${stamp}`);
  const admin = await registerViaApi(baseUrl, `admin_${stamp}`);
  const admin2 = await registerViaApi(baseUrl, `admin2_${stamp}`);
  const member = await registerViaApi(baseUrl, `member_${stamp}`);

  const group = await conversationRepository.createGroup({
    name: "Role test",
    ownerId: owner.user.id,
    memberIds: [admin.user.id, admin2.user.id, member.user.id]
  });

  await query(
    `UPDATE conversation_participants SET role = 'admin'
     WHERE conversation_id = $1 AND user_id IN ($2, $3)`,
    [group.id, admin.user.id, admin2.user.id]
  );

  try {
    await conversationRepository.removeGroupParticipant(
      group.id,
      admin.user.id,
      member.user.id
    );
  } catch (error) {
    assert.fail(`Admin remove member phải pass: ${error.message}`);
  }

  try {
    await conversationRepository.removeGroupParticipant(
      group.id,
      admin.user.id,
      owner.user.id
    );
    assert.fail("Admin remove owner phải reject");
  } catch (error) {
    assert.match(error.message, /owner/);
  }

  try {
    await conversationRepository.removeGroupParticipant(
      group.id,
      admin.user.id,
      admin2.user.id
    );
    assert.fail("Admin remove admin khác phải reject");
  } catch (error) {
    assert.match(error.message, /admin/);
  }

  await conversationRepository.removeGroupParticipant(
    group.id,
    owner.user.id,
    admin.user.id
  );

  try {
    await conversationRepository.removeGroupParticipant(
      group.id,
      owner.user.id,
      owner.user.id
    );
    assert.fail("Owner tự leave phải reject");
  } catch (error) {
    assert.match(error.message, /chuyển quyền/);
  }

  const transfer = await fetch(
    `${baseUrl}/api/conversations/${group.id}/transfer-owner`,
    {
      method: "POST",
      headers: csrfHeaders(owner.csrfToken, owner.cookie),
      body: JSON.stringify({ userId: admin2.user.id })
    }
  );
  const transferData = await transfer.json();
  assert.equal(transferData.ok, true, transferData.error);

  const ownerRole = await conversationRepository.getParticipantRole(
    group.id,
    owner.user.id
  );
  const newOwnerRole = await conversationRepository.getParticipantRole(
    group.id,
    admin2.user.id
  );
  assert.equal(ownerRole, "admin");
  assert.equal(newOwnerRole, "owner");

  await closePool();
  await new Promise((resolve) => server.close(resolve));
  console.log("Đã kiểm tra group role hierarchy và transfer owner.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});