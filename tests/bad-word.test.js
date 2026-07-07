const assert = require("assert");
const { filterMessageText, normalizeWord, isValidSeverity } = require("../src/utils/bad-word");

const words = [
  { word: "spam", severity: "low", replacement: "***" },
  { word: "blocked", severity: "high", replacement: "***" },
  { word: "warn", severity: "medium", replacement: "[censored]" }
];

const lowOnly = filterMessageText("Đây là spam test", words);
assert.equal(lowOnly.blocked, false);
assert.equal(lowOnly.wasFiltered, true);
assert.ok(lowOnly.text.includes("***"));
assert.deepEqual(lowOnly.hits, ["spam"]);

const blocked = filterMessageText("Tin nhắn blocked ngay", words);
assert.equal(blocked.blocked, true);
assert.equal(blocked.wasFiltered, false);

const clean = filterMessageText("Xin chào mọi người", words);
assert.equal(clean.blocked, false);
assert.equal(clean.wasFiltered, false);
assert.equal(clean.text, "Xin chào mọi người");

assert.equal(normalizeWord("  HeLLo   World "), "hello world");
assert.equal(isValidSeverity("low"), true);
assert.equal(isValidSeverity("invalid"), false);

console.log("Đã kiểm tra bad-word filter helper.");