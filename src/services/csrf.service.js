const crypto = require("crypto");
const config = require("../config/env");

function getCsrfSecret() {
  return config.csrfSecret || config.jwtSecret || "";
}

function buildHmacMessage({ sub, sid, raw }) {
  if (sub && sid) {
    return `csrf:${sub}:${sid}:${raw}`;
  }
  return `csrf:anon:${raw}`;
}

function signToken(raw, session = {}) {
  const secret = getCsrfSecret();
  if (!secret) {
    return raw;
  }

  const message = buildHmacMessage({
    sub: session.sub || null,
    sid: session.sid || null,
    raw
  });
  const signature = crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("hex");
  return `${raw}.${signature}`;
}

function generateCsrfToken(session = {}) {
  const raw = crypto.randomBytes(32).toString("hex");
  return signToken(raw, session);
}

function verifyCsrfToken(token, session = {}) {
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

  const expected = signToken(raw, session).slice(dotIndex + 1);
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

function validateCsrfRequest(cookieToken, headerToken, session = null) {
  if (!tokensMatch(cookieToken, headerToken)) {
    return false;
  }

  const binding = session?.sub && session?.sid ? session : {};
  return (
    verifyCsrfToken(cookieToken, binding) && verifyCsrfToken(headerToken, binding)
  );
}

module.exports = {
  generateCsrfToken,
  verifyCsrfToken,
  tokensMatch,
  validateCsrfRequest,
  buildHmacMessage
};