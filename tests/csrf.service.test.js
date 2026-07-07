process.env.JWT_SECRET = "test-secret-key-32chars-minimum!";
process.env.CSRF_SECRET = "csrf-secret-key-32chars-minimum!";

const csrfService = require("../src/services/csrf.service");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const token = csrfService.generateCsrfToken();
assert(csrfService.verifyCsrfToken(token), "Generated token should verify");
assert(
  csrfService.validateCsrfRequest(token, token),
  "Matching cookie/header should validate"
);
assert(
  !csrfService.validateCsrfRequest(token, token + "x"),
  "Mismatched tokens should fail"
);

console.log("Đã kiểm tra CSRF service.");