process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-secret-key-32chars-minimum!";

const assert = require("assert");
const http = require("http");
const app = require("../src/app");
const { getDatabaseError, closePool } = require("../src/db");
const { extractCookie } = require("./helpers/http");
const {
  fetchCsrf,
  csrfHeaders,
  sessionFromAuthResponse
} = require("./helpers/csrf");

async function registerAndLogin(baseUrl) {
  const csrf = await fetchCsrf(baseUrl);
  const stamp = Date.now();
  const username = `profile_user_${stamp}`;
  const email = `${username}@test.local`;
  const password = "secret12345";

  const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
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

  const authSession = sessionFromAuthResponse(registerResponse, registerData);

  return {
    username,
    email,
    password,
    ...authSession,
    user: registerData.user
  };
}

function sessionHeaders(session) {
  return {
    headers: csrfHeaders(session.csrfToken, session.apiCookie),
    readCookie: session.apiCookie
  };
}

async function run() {
  if (getDatabaseError()) {
    console.log("Bỏ qua profile API test vì thiếu DATABASE_URL.");
    return;
  }

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const session = await registerAndLogin(baseUrl);

    const readSession = sessionHeaders(session);
    const profile = await fetch(`${baseUrl}/api/users/me`, {
      headers: { Cookie: readSession.readCookie }
    });
    const profileData = await profile.json();
    assert.equal(profileData.ok, true);
    assert.equal(profileData.user.username, session.username);

    const writeSession = sessionHeaders(session);
    const patch = await fetch(`${baseUrl}/api/users/me`, {
      method: "PATCH",
      headers: writeSession.headers,
      body: JSON.stringify({
        displayName: "Profile Tester",
        bio: "Bio test"
      })
    });
    const patchData = await patch.json();
    assert.equal(patchData.ok, true, patchData.error || JSON.stringify(patchData));
    assert.equal(patchData.user.displayName, "Profile Tester");
    assert.equal(patchData.user.bio, "Bio test");

    const passwordSession = sessionHeaders(session);
    const badPassword = await fetch(`${baseUrl}/api/users/me/change-password`, {
      method: "POST",
      headers: passwordSession.headers,
      body: JSON.stringify({
        oldPassword: "wrong",
        password: "newsecret123",
        confirmPassword: "newsecret123"
      })
    });
    const badPasswordData = await badPassword.json();
    assert.equal(badPasswordData.ok, false);

    const changeSession = sessionHeaders(session);
    const changePassword = await fetch(`${baseUrl}/api/users/me/change-password`, {
      method: "POST",
      headers: changeSession.headers,
      body: JSON.stringify({
        oldPassword: session.password,
        password: "newsecret123",
        confirmPassword: "newsecret123"
      })
    });
    const changePasswordData = await changePassword.json();
    assert.equal(changePasswordData.ok, true);

    const loginCsrf = await fetchCsrf(baseUrl);
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: csrfHeaders(loginCsrf.token, loginCsrf.cookie),
      body: JSON.stringify({
        usernameOrEmail: session.username,
        password: "newsecret123"
      })
    });
    const loginData = await login.json();
    assert.equal(loginData.ok, true);

    console.log("Đã kiểm tra profile GET/PATCH và change-password.");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await closePool();
  }
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });