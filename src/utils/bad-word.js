const SEVERITIES = new Set(["low", "medium", "high"]);

function normalizeWord(word) {
  return String(word || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function filterMessageText(text, words = []) {
  const original = String(text || "");
  if (!original.trim() || !words.length) {
    return {
      text: original,
      blocked: false,
      wasFiltered: false,
      hits: []
    };
  }

  let filtered = original;
  const hits = [];
  let blocked = false;

  const sorted = [...words].sort(
    (a, b) => normalizeWord(b.word).length - normalizeWord(a.word).length
  );

  for (const entry of sorted) {
    const pattern = normalizeWord(entry.word);
    if (!pattern) continue;

    const regex = new RegExp(escapeRegExp(pattern), "gi");
    if (!regex.test(filtered)) continue;

    hits.push({
      word: entry.word,
      severity: entry.severity || "low"
    });

    if (entry.severity === "high") {
      blocked = true;
      break;
    }

    const replacement = entry.replacement || "***";
    filtered = filtered.replace(new RegExp(escapeRegExp(pattern), "gi"), replacement);
  }

  return {
    text: filtered,
    blocked,
    wasFiltered: hits.length > 0 && !blocked,
    hits: hits.map((item) => item.word)
  };
}

function isValidSeverity(severity) {
  return SEVERITIES.has(severity);
}

module.exports = {
  normalizeWord,
  filterMessageText,
  isValidSeverity,
  SEVERITIES
};