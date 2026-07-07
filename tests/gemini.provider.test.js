process.env.JWT_SECRET = "test-secret-key-32chars-minimum!";
process.env.GEMINI_API_KEY = "test-gemini-key-should-not-leak";

const assert = require("assert");
const geminiProvider = require("../src/services/ai-providers/gemini.provider");
const logger = require("../src/utils/logger");

const originalFetch = global.fetch;
global.fetch = async (url, options = {}) => {
  assert.ok(!String(url).includes("key="), "API key không được nằm trong URL");
  assert.equal(options.headers["x-goog-api-key"], process.env.GEMINI_API_KEY);
  return {
    ok: false,
    status: 400,
    json: async () => ({
      error: { message: "Invalid request" }
    })
  };
};

async function run() {
  try {
    await geminiProvider.generateReply({
      messages: [{ role: "user", content: "hello" }]
    });
    assert.fail("Phải throw khi Gemini trả lỗi");
  } catch (error) {
    assert.ok(!String(error.message).includes(process.env.GEMINI_API_KEY));
    const redacted = logger.redactString(
      `https://generativelanguage.googleapis.com?key=${process.env.GEMINI_API_KEY}`
    );
    assert.ok(!redacted.includes(process.env.GEMINI_API_KEY));
  } finally {
    global.fetch = originalFetch;
  }

  console.log("Đã kiểm tra Gemini header key và error redaction.");
}

run().catch((error) => {
  global.fetch = originalFetch;
  console.error(error);
  process.exitCode = 1;
});