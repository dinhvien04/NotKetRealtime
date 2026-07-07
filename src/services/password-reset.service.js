const crypto = require("crypto");
const argon2 = require("argon2");
const config = require("../config/env");
const userRepository = require("../repositories/user.repository");
const passwordResetRepository = require("../repositories/password-reset.repository");
const auditService = require("./audit.service");
const mailerService = require("./mailer.service");
const {
  validatePassword,
  ARGON2_OPTIONS
} = require("./auth.service");

const GENERIC_FORGOT_MESSAGE =
  "Nếu email tồn tại trong hệ thống, mã OTP đã được gửi.";
const MAX_VERIFY_ATTEMPTS = 5;

function hashOtp(otp) {
  return crypto
    .createHmac("sha256", config.otpPepper)
    .update(String(otp))
    .digest("hex");
}

function verifyOtpHash(otp, otpHash) {
  const expected = hashOtp(otp);
  const left = Buffer.from(expected);
  const right = Buffer.from(otpHash);
  if (left.length !== right.length) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

async function requestOtp({ email, req }) {
  const cleanedEmail = String(email || "")
    .trim()
    .toLowerCase();
  if (!cleanedEmail) {
    throw new Error("Vui lòng nhập email.");
  }

  const user = await userRepository.findByEmail(cleanedEmail);
  if (user && user.status === "active" && !user.is_locked) {
    await passwordResetRepository.invalidateActiveForEmail(cleanedEmail);
    const otp = generateOtp();
    const expiresAt = new Date(
      Date.now() + config.passwordResetOtpTtlMinutes * 60 * 1000
    );

    const token = await passwordResetRepository.createToken({
      userId: user.id,
      email: cleanedEmail,
      otpHash: hashOtp(otp),
      expiresAt,
      requestIp: req ? require("../utils/request-meta").getClientIp(req) : null
    });

    await mailerService.sendPasswordResetOtp({
      to: cleanedEmail,
      otp,
      expiresMinutes: config.passwordResetOtpTtlMinutes
    });

    await auditService.log({
      actorId: user.id,
      actorRole: user.role,
      action: "auth.forgot_password",
      targetType: "password_reset_token",
      targetId: token.id,
      req
    });
  }

  return { message: GENERIC_FORGOT_MESSAGE };
}

async function verifyOtp({ email, otp, req }) {
  const cleanedEmail = String(email || "")
    .trim()
    .toLowerCase();
  const cleanedOtp = String(otp || "").trim();

  if (!cleanedEmail || !/^\d{6}$/.test(cleanedOtp)) {
    throw new Error("Email hoặc OTP không hợp lệ.");
  }

  const token = await passwordResetRepository.findActiveByEmail(cleanedEmail);
  if (!token) {
    throw new Error("OTP không hợp lệ hoặc đã hết hạn.");
  }

  if (token.verify_attempts >= MAX_VERIFY_ATTEMPTS) {
    throw new Error("Đã vượt quá số lần thử OTP. Vui lòng yêu cầu mã mới.");
  }

  if (!verifyOtpHash(cleanedOtp, token.otp_hash)) {
    await passwordResetRepository.incrementVerifyAttempts(token.id);
    throw new Error("OTP không hợp lệ hoặc đã hết hạn.");
  }

  await passwordResetRepository.markVerified(token.id);

  await auditService.log({
    actorId: token.user_id,
    action: "auth.verify_reset_otp",
    targetType: "password_reset_token",
    targetId: token.id,
    req
  });

  return {
    resetTokenId: token.id,
    expiresAt: token.expires_at
  };
}

async function resetPassword({
  resetTokenId,
  password,
  confirmPassword,
  req
}) {
  validatePassword(password);
  if (password !== confirmPassword) {
    throw new Error("Mật khẩu xác nhận không khớp.");
  }

  const token = await passwordResetRepository.findById(resetTokenId);
  if (
    !token ||
    token.used_at ||
    !token.verified_at ||
    new Date(token.expires_at).getTime() < Date.now()
  ) {
    throw new Error("Phiên đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.");
  }

  const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);
  await userRepository.updatePassword(token.user_id, passwordHash);
  await passwordResetRepository.markUsed(token.id);

  const user = await userRepository.findById(token.user_id);
  await auditService.log({
    actorId: token.user_id,
    actorRole: user?.role || "user",
    action: "auth.reset_password",
    targetType: "user",
    targetId: token.user_id,
    req
  });

  return { ok: true };
}

module.exports = {
  requestOtp,
  verifyOtp,
  resetPassword,
  hashOtp,
  verifyOtpHash,
  GENERIC_FORGOT_MESSAGE
};