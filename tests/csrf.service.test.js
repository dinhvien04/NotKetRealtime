process.env.JWT_SECRET = "test-secret-key-32chars-minimum!";
process.env.CSRF_SECRET = "csrf-secret-key-32chars-minimum!";

const assert = require("assert");
const csrfService = require("../src/services/csrf.service");

const sessionA = {
  sub: "11111111-1111-1111-1111-111111111111",
  sid: "session-a"
};
const sessionB = {
  sub: "22222222-2222-2222-2222-222222222222",
  sid: "session-b"
};

const tokenA = csrfService.generateCsrfToken(sessionA);
const tokenB = csrfService.generateCsrfToken(sessionB);
const anonToken = csrfService.generateCsrfToken();

assert(csrfService.verifyCsrfToken(tokenA, sessionA), "Token A verify với session A");
assert(
  !csrfService.verifyCsrfToken(tokenA, sessionB),
  "Token A không verify với session B"
);
assert(
  csrfService.validateCsrfRequest(tokenA, tokenA, sessionA),
  "Matching cookie/header session A"
);
assert(
  !csrfService.validateCsrfRequest(tokenA, tokenA, sessionB),
  "Token A fail với session B"
);
assert(
  csrfService.validateCsrfRequest(anonToken, anonToken, null),
  "Anonymous token cho login/register"
);
assert(
  !csrfService.validateCsrfRequest(anonToken, anonToken, sessionA),
  "Anonymous token không dùng cho session đã login"
);
assert(
  !csrfService.validateCsrfRequest(tokenA, tokenA + "x", sessionA),
  "Mismatched tokens fail"
);

console.log("Đã kiểm tra CSRF session binding.");