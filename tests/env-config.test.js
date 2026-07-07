const assert = require("assert");
const { parseSupabaseStoragePublic } = require("../src/config/env");

assert.equal(parseSupabaseStoragePublic(undefined), false);
assert.equal(parseSupabaseStoragePublic(""), false);
assert.equal(parseSupabaseStoragePublic("true"), true);
assert.equal(parseSupabaseStoragePublic("1"), true);
assert.equal(parseSupabaseStoragePublic("false"), false);
assert.equal(parseSupabaseStoragePublic("0"), false);

console.log("Đã kiểm tra SUPABASE_STORAGE_PUBLIC default và parsing.");