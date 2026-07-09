const assert = require("assert");
const {
  extractLinksFromBody,
  normalizeUrl
} = require("../src/services/document-message.service");

async function run() {
  assert.deepEqual(extractLinksFromBody("hello"), []);
  assert.deepEqual(
    extractLinksFromBody("xem https://example.com/a và https://example.com/a"),
    ["https://example.com/a"]
  );
  assert.ok(
    extractLinksFromBody("mở www.example.org/path").some((u) =>
      u.includes("example.org")
    )
  );
  assert.equal(normalizeUrl("https://x.com/y."), "https://x.com/y");
  assert.equal(normalizeUrl("ftp://bad"), null);

  console.log("extract-links.test.js OK");
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
