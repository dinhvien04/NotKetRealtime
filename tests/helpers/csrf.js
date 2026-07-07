const { extractCookie } = require("./http");

async function fetchCsrf(baseUrl) {
  const response = await fetch(`${baseUrl}/api/csrf-token`);
  const data = await response.json();
  const csrfCookie = extractCookie(response, "notket_csrf");
  return {
    token: data.csrfToken,
    cookie: csrfCookie
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

module.exports = {
  fetchCsrf,
  csrfHeaders,
  mergeCookies
};