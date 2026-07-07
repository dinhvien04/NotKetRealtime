const config = require("../../config/env");

const DEFAULT_MODEL = "gemini-2.0-flash";
const PROVIDER_TIMEOUT_MS = 30_000;

async function generateReply({ messages, model }) {
  const apiKey = config.geminiApiKey;
  if (!apiKey) {
    throw new Error("AI chưa được cấu hình. Thiếu GEMINI_API_KEY.");
  }

  const selectedModel = model || config.geminiModel || DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const contents = messages.map((entry) => ({
    role: entry.role === "assistant" ? "model" : "user",
    parts: [{ text: String(entry.content || "").slice(0, config.aiMaxInputChars) }]
  }));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.7
        }
      }),
      signal: controller.signal
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        payload?.error?.message || `Gemini API lỗi (${response.status}).`;
      throw new Error(message);
    }

    const text =
      payload?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim() || "";

    if (!text) {
      throw new Error("AI không trả lời nội dung.");
    }

    const usage = payload?.usageMetadata || {};
    return {
      content: text,
      provider: "gemini",
      model: selectedModel,
      tokensInput: usage.promptTokenCount ?? null,
      tokensOutput: usage.candidatesTokenCount ?? null
    };
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("AI phản hồi quá chậm. Vui lòng thử lại.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  generateReply
};