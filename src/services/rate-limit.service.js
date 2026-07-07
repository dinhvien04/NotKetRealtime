const buckets = new Map();

const LIMITS = {
  private_message: { max: 30, windowMs: 60_000 },
  public_message: { max: 30, windowMs: 60_000 },
  group_message: { max: 30, windowMs: 60_000 },
  typing: { max: 60, windowMs: 60_000 },
  load_messages: { max: 60, windowMs: 60_000 },
  mark_read: { max: 120, windowMs: 60_000 },
  edit_message: { max: 30, windowMs: 60_000 },
  delete_message: { max: 30, windowMs: 60_000 },
  add_reaction: { max: 60, windowMs: 60_000 },
  remove_reaction: { max: 60, windowMs: 60_000 },
  ai_message: { max: 10, windowMs: 60_000 }
};

const RATE_LIMIT_ERROR = "Thao tác quá nhanh. Vui lòng thử lại sau.";

function getBucketKey(userId, event) {
  return `${userId}:${event}`;
}

function checkRateLimit(userId, event) {
  if (!userId || !event) {
    return { allowed: true };
  }

  const rule = LIMITS[event];
  if (!rule) {
    return { allowed: true };
  }

  const key = getBucketKey(userId, event);
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + rule.windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;
  if (bucket.count > rule.max) {
    return { allowed: false, error: RATE_LIMIT_ERROR };
  }

  return { allowed: true };
}

function resetRateLimits() {
  buckets.clear();
}

module.exports = {
  LIMITS,
  RATE_LIMIT_ERROR,
  checkRateLimit,
  resetRateLimits
};