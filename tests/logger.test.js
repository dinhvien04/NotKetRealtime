const assert = require("assert");
const logger = require("../src/utils/logger");

let output = "";
const originalLog = console.log;
console.log = (...args) => {
  output += args
    .map((entry) =>
      typeof entry === "object" ? JSON.stringify(entry) : String(entry)
    )
    .join(" ");
};

try {
  logger.info("health-check");
  assert.ok(output.includes("health-check"));

  output = "";
  logger.info("gemini call", {
    url: "https://example.com?key=super-secret-key&other=1",
    authorization: "Bearer abc.def.ghi",
    cookie: "notket_token=secret"
  });
  assert.ok(!output.includes("super-secret-key"));
  assert.ok(output.includes("[REDACTED]"));
  assert.ok(!output.includes("abc.def.ghi"));

  const redacted = logger.redactString(
    "fetch https://api.test?api_key=hidden&token=also-hidden"
  );
  assert.ok(!redacted.includes("hidden"));
  assert.ok(redacted.includes("[REDACTED]"));

  console.log = originalLog;
  console.log("Đã kiểm tra logger redaction.");
} catch (error) {
  console.log = originalLog;
  throw error;
}