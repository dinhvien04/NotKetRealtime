const assert = require("assert");
const { parseBooleanEnv } = require("../src/config/env");

assert.equal(parseBooleanEnv(undefined), false);
assert.equal(parseBooleanEnv(""), false);
assert.equal(parseBooleanEnv("true"), true);
assert.equal(parseBooleanEnv("1"), true);
assert.equal(parseBooleanEnv("false"), false);
assert.equal(parseBooleanEnv("0"), false);
assert.equal(parseBooleanEnv("true", false), true);
assert.equal(parseBooleanEnv(undefined, true), true);

console.log("Đã kiểm tra parseBooleanEnv và S3 env parsing helpers.");