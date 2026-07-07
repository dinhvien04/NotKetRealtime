const crypto = require("crypto");
const config = require("../config/env");

function getCsrfSecret() {
  return config.csrfSecret || config.jwtSecret || "";
}

function generateCsrfToken() {
  const raw = crypto.randomBytes(32).toString("hex");
  const secret = getCsrfSecret();
  if (!secret) {
    return raw;
  }

  const signature = crypto
    .createHmac("sha256", secret)
    .update(raw)
    .digest("hex");
  return `${raw}.${signature}`;
}

function verifyCsrfToken(token) {
  if (!token || typeof token !== "string") {
    return false;
  }

  const secret = getCsrfSecret();
  const dotIndex = token.lastIndexOf(".");
  if (!secret || dotIndex === -1) {
    return token.length >= 32;
  }

  const raw = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);
  if (!raw || !signature) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(raw)
    .digest("hex");

  if (expected.length !== signature.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

function tokensMatch(cookieToken, headerToken) {
  if (!cookieToken || !headerToken) {
    return false;
  }

  if (cookieToken.length !== headerToken.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(cookieToken),
    Buffer.from(headerToken)
  );
}

function validateCsrfRequest(cookieToken, headerToken) {
  if (!tokensMatch(cookieToken, headerToken)) {
    return false;
  }

  return verifyCsrfToken(cookieToken) && verifyCsrfToken(headerToken);
}

module.exports = {
  generateCsrfToken,
  verifyCsrfToken,
  tokensMatch,
  validateCsrfRequest
};