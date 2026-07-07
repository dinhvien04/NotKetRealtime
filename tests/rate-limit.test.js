const rateLimitService = require("../src/services/rate-limit.service");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

rateLimitService.resetRateLimits();

const userId = "user-test-1";
const event = "private_message";
const limit = rateLimitService.LIMITS[event].max;

for (let i = 0; i < limit; i += 1) {
  const result = rateLimitService.checkRateLimit(userId, event);
  assert(result.allowed, `Request ${i + 1} should be allowed`);
}

const blocked = rateLimitService.checkRateLimit(userId, event);
assert(!blocked.allowed, "Should block after limit exceeded");
assert(
  blocked.error === rateLimitService.RATE_LIMIT_ERROR,
  "Should return rate limit error message"
);

console.log("Đã kiểm tra socket rate-limit service.");