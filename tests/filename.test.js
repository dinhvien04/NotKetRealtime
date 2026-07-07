const { sanitizeFileName } = require("../src/utils/filename");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(sanitizeFileName("../../etc/passwd") === "passwd", "Should strip path traversal");
assert(sanitizeFileName("a".repeat(300)).length <= 120, "Should cap filename length");
assert(sanitizeFileName("") === "file", "Empty filename fallback");

console.log("Đã kiểm tra filename sanitize.");