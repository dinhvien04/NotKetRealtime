const config = require("../config/env");
const aiRepository = require("../repositories/ai.repository");
const geminiProvider = require("./ai-providers/gemini.provider");
const auditService = require("./audit.service");

function sanitizeInput(text) {
  const cleaned = String(text || "").trim();
  if (!cleaned) {
    throw new Error("Nội dung tin nhắn AI không hợp lệ.");
  }
  if (cleaned.length > config.aiMaxInputChars) {
    throw new Error(`Tin nhắn AI tối đa ${config.aiMaxInputChars} ký tự.`);
  }
  return cleaned;
}

function getProvider() {
  if (config.aiProvider === "gemini") {
    return geminiProvider;
  }
  throw new Error("AI provider không được hỗ trợ.");
}

async function listSessions(userId) {
  return aiRepository.listSessions(userId);
}

async function createSession(userId, title = null) {
  const session = await aiRepository.createSession(
    userId,
    title ? String(title).trim().slice(0, 120) : "Cuộc trò chuyện AI"
  );
  return session;
}

async function getSessionMessages(userId, sessionId) {
  const session = await aiRepository.findSessionForUser(sessionId, userId);
  if (!session) {
    throw new Error("Phiên AI không tồn tại.");
  }
  const messages = await aiRepository.listMessages(sessionId);
  return { session, messages };
}

async function deleteSession(userId, sessionId, req = null) {
  const removed = await aiRepository.deleteSession(sessionId, userId);
  if (!removed) {
    throw new Error("Phiên AI không tồn tại.");
  }

  await auditService.log({
    actorId: userId,
    actorRole: "user",
    action: "ai.session.delete",
    targetType: "ai_session",
    targetId: removed.id,
    details: {},
    req
  });

  return removed;
}

async function sendMessage(userId, sessionId, input, req = null) {
  const session = await aiRepository.findSessionForUser(sessionId, userId);
  if (!session) {
    throw new Error("Phiên AI không tồn tại.");
  }

  const content = sanitizeInput(input);
  const userMessage = await aiRepository.addMessage({
    sessionId,
    role: "user",
    content
  });

  const history = await aiRepository.getRecentMessages(sessionId, 10);
  let aiResult;
  if (config.nodeEnv === "test" && !config.geminiApiKey) {
    aiResult = {
      content: "Đây là phản hồi AI mock cho môi trường test.",
      provider: "mock",
      model: "mock",
      tokensInput: 1,
      tokensOutput: 1
    };
  } else {
    const provider = getProvider();
    aiResult = await provider.generateReply({ messages: history });
  }

  const assistantMessage = await aiRepository.addMessage({
    sessionId,
    role: "assistant",
    content: aiResult.content,
    provider: aiResult.provider,
    model: aiResult.model,
    tokensInput: aiResult.tokensInput,
    tokensOutput: aiResult.tokensOutput
  });

  await aiRepository.touchSession(sessionId);

  await auditService.log({
    actorId: userId,
    actorRole: "user",
    action: "ai.message.send",
    targetType: "ai_session",
    targetId: sessionId,
    details: { provider: aiResult.provider, model: aiResult.model },
    req
  });

  return {
    session,
    userMessage,
    assistantMessage
  };
}

module.exports = {
  listSessions,
  createSession,
  getSessionMessages,
  deleteSession,
  sendMessage,
  sanitizeInput
};