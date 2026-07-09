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

  // bracket / brace / trailing junk
  assert.deepEqual(extractLinksFromBody("xem [https://example.com]"), [
    "https://example.com/"
  ]);
  assert.deepEqual(extractLinksFromBody("xem https://example.com/path}"), [
    "https://example.com/path"
  ]);

  // dangerous schemes must not extract
  assert.deepEqual(extractLinksFromBody("javascript:alert(1)"), []);
  assert.deepEqual(extractLinksFromBody("click javascript:alert(1) now"), []);
  assert.equal(normalizeUrl("javascript:alert(1)"), null);

  // www + trailing period
  assert.deepEqual(extractLinksFromBody("www.example.com."), [
    "https://www.example.com/"
  ]);

  console.log("extract-links.test.js OK");
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
