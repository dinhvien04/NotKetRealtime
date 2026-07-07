const { extractCookie } = require("./http");

async function fetchCsrf(baseUrl, cookie = "") {
  const response = await fetch(`${baseUrl}/api/csrf-token`, {
    headers: cookie ? { Cookie: cookie } : undefined
  });
  const data = await response.json();
  const csrfCookie = extractCookie(response, "notket_csrf");
  return {
    token: data.csrfToken,
    cookie: cookie ? mergeCookies(cookie, csrfCookie) : csrfCookie
  };
}

function csrfHeaders(token, cookie = "") {
  const headers = {
    "Content-Type": "application/json",
    "X-CSRF-Token": token
  };
  if (cookie) {
    headers.Cookie = cookie;
  }
  return headers;
}

function mergeCookies(...parts) {
  return parts.filter(Boolean).join("; ");
}

function sessionFromAuthResponse(response, data) {
  const { extractCookie } = require("./http");
  const authCookie = extractCookie(response);
  const csrfToken = data.csrfToken;
  return {
    csrfToken,
    authCookie,
    apiCookie: mergeCookies(authCookie, csrfToken ? `notket_csrf=${csrfToken}` : "")
  };
}

module.exports = {
  fetchCsrf,
  csrfHeaders,
  mergeCookies,
  sessionFromAuthResponse
};