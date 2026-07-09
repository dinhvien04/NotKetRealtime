const assert = require("assert");
const { sanitizeFileName } = require("../src/utils/filename");

async function run() {
  assert.equal(sanitizeFileName("hello world.png"), "hello_world.png");
  assert.equal(sanitizeFileName("../evil/../../x.txt"), "x.txt");
  assert.ok(sanitizeFileName("a".repeat(300)).length <= 120);
  assert.equal(sanitizeFileName(""), "file");
  console.log("filename.test.js OK");
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
