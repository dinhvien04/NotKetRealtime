const badWordRepository = require("../repositories/bad-word.repository");
const auditService = require("./audit.service");
const {
  normalizeWord,
  filterMessageText,
  isValidSeverity
} = require("../utils/bad-word");

let cachedWords = [];
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 60000;

async function refreshCache(force = false) {
  const now = Date.now();
  if (!force && cachedWords.length && now - cacheLoadedAt < CACHE_TTL_MS) {
    return cachedWords;
  }

  cachedWords = await badWordRepository.listAll();
  cacheLoadedAt = now;
  return cachedWords;
}

async function applyTextFilter(text, options = {}) {
  const words = await refreshCache();
  const result = filterMessageText(text, words);

  if (result.blocked) {
    throw new Error("Tin nhắn chứa nội dung không được phép.");
  }

  if (result.wasFiltered && options.auditContext) {
    const hasMedium = words.some(
      (entry) =>
        result.hits.includes(entry.word) && entry.severity === "medium"
    );
    if (hasMedium) {
      await auditService.log({
        actorId: options.auditContext.actorId || null,
        actorRole: options.auditContext.actorRole || "user",
        action: "message.filtered",
        targetType: "message",
        targetId: null,
        details: { hits: result.hits },
        req: options.auditContext.req || null
      });
    }
  }

  return result;
}

async function listBadWords(options = {}) {
  return badWordRepository.list(options);
}

async function createBadWord(actorId, actorRole, payload = {}, req = null) {
  const word = normalizeWord(payload.word);
  if (!word || word.length < 2 || word.length > 80) {
    throw new Error("Từ cấm không hợp lệ.");
  }

  const severity = payload.severity || "low";
  if (!isValidSeverity(severity)) {
    throw new Error("Mức độ từ cấm không hợp lệ.");
  }

  const replacement = String(payload.replacement || "***").trim().slice(0, 40) || "***";
  const existing = await badWordRepository.findByWord(word);
  if (existing) {
    throw new Error("Từ cấm đã tồn tại.");
  }

  const created = await badWordRepository.create({
    word,
    severity,
    replacement,
    createdBy: actorId
  });

  await refreshCache(true);
  await auditService.log({
    actorId,
    actorRole,
    action: "bad_word.create",
    targetType: "bad_word",
    targetId: created.id,
    details: { word: created.word, severity: created.severity },
    req
  });

  return created;
}

async function updateBadWord(actorId, actorRole, id, payload = {}, req = null) {
  const existing = await badWordRepository.findById(id);
  if (!existing) {
    throw new Error("Từ cấm không tồn tại.");
  }

  const severity = payload.severity !== undefined ? payload.severity : existing.severity;
  if (!isValidSeverity(severity)) {
    throw new Error("Mức độ từ cấm không hợp lệ.");
  }

  const replacement =
    payload.replacement !== undefined
      ? String(payload.replacement || "***").trim().slice(0, 40) || "***"
      : existing.replacement;

  const updated = await badWordRepository.update(id, { severity, replacement });
  if (!updated) {
    throw new Error("Từ cấm không tồn tại.");
  }

  await refreshCache(true);
  await auditService.log({
    actorId,
    actorRole,
    action: "bad_word.update",
    targetType: "bad_word",
    targetId: updated.id,
    details: { word: updated.word, severity: updated.severity },
    req
  });

  return updated;
}

async function deleteBadWord(actorId, actorRole, id, req = null) {
  const removed = await badWordRepository.remove(id);
  if (!removed) {
    throw new Error("Từ cấm không tồn tại.");
  }

  await refreshCache(true);
  await auditService.log({
    actorId,
    actorRole,
    action: "bad_word.delete",
    targetType: "bad_word",
    targetId: removed.id,
    details: { word: removed.word },
    req
  });

  return removed;
}

module.exports = {
  refreshCache,
  applyTextFilter,
  listBadWords,
  createBadWord,
  updateBadWord,
  deleteBadWord,
  filterMessageText
};