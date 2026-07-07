const argon2 = require("argon2");
const userRepository = require("../repositories/user.repository");
const auditService = require("./audit.service");
const {
  validateEmail,
  validatePassword,
  ARGON2_OPTIONS
} = require("./auth.service");
const { sanitizeBio, sanitizeDisplayName } = require("../utils/sanitize");

async function getProfile(userId) {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new Error("Người dùng không tồn tại.");
  }
  return userRepository.toPublicUser(user);
}

async function updateProfile(userId, payload = {}, req = null) {
  const updates = {};

  if (payload.displayName !== undefined) {
    updates.displayName = sanitizeDisplayName(payload.displayName);
    if (!updates.displayName) {
      throw new Error("Tên hiển thị không hợp lệ.");
    }
  }

  if (payload.bio !== undefined) {
    updates.bio = sanitizeBio(payload.bio);
  }

  if (payload.email !== undefined) {
    const cleanedEmail = validateEmail(payload.email);
    if (cleanedEmail) {
      const existing = await userRepository.findByEmail(cleanedEmail);
      if (existing && existing.id !== userId) {
        throw new Error("Email đã được sử dụng.");
      }
    }
    updates.email = cleanedEmail;
  }

  const user = await userRepository.updateProfile(userId, updates);

  await auditService.log({
    actorId: userId,
    actorRole: user.role,
    action: "profile.update",
    targetType: "user",
    targetId: userId,
    details: { fields: Object.keys(updates) },
    req
  });

  return user;
}

async function updateAvatar(userId, avatarUrl, req = null) {
  const user = await userRepository.updateProfile(userId, { avatarUrl });

  await auditService.log({
    actorId: userId,
    actorRole: user.role,
    action: "profile.avatar_update",
    targetType: "user",
    targetId: userId,
    req
  });

  return user;
}

async function changePassword(
  userId,
  { oldPassword, password, confirmPassword },
  req = null
) {
  validatePassword(password);
  if (password !== confirmPassword) {
    throw new Error("Mật khẩu xác nhận không khớp.");
  }

  const user = await userRepository.findById(userId);
  if (!user) {
    throw new Error("Người dùng không tồn tại.");
  }

  const valid = await argon2.verify(user.password_hash, oldPassword || "");
  if (!valid) {
    throw new Error("Mật khẩu hiện tại không đúng.");
  }

  const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);
  await userRepository.updatePassword(userId, passwordHash);

  await auditService.log({
    actorId: userId,
    actorRole: user.role,
    action: "auth.change_password",
    targetType: "user",
    targetId: userId,
    req
  });

  return { ok: true };
}

module.exports = {
  getProfile,
  updateProfile,
  updateAvatar,
  changePassword
};