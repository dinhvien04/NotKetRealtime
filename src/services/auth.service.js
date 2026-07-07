const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const config = require("../config/env");
const userRepository = require("../repositories/user.repository");
const auditService = require("./audit.service");
const { sanitizeUsername } = require("../utils/sanitize");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_JWT_SECRET_LENGTH = 32;
const MAX_PASSWORD_LENGTH = 128;
const LOGIN_ERROR = "Thông tin đăng nhập không chính xác.";

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
};

function getAuthConfigError() {
  if (!config.jwtSecret) {
    return "Thiếu JWT_SECRET. Vui lòng cấu hình biến môi trường JWT_SECRET.";
  }
  if (config.jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    return `JWT_SECRET phải có ít nhất ${MIN_JWT_SECRET_LENGTH} ký tự.`;
  }
  return null;
}

function validateUsername(username) {
  const cleaned = sanitizeUsername(username);
  if (!cleaned || cleaned.length < 3 || cleaned.length > 40) {
    throw new Error("Username phải từ 3 đến 40 ký tự.");
  }
  return cleaned;
}

function validateEmail(email) {
  if (!email) return null;
  const cleaned = String(email).trim().toLowerCase();
  if (!EMAIL_PATTERN.test(cleaned)) {
    throw new Error("Email không hợp lệ.");
  }
  return cleaned;
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("Mật khẩu phải có ít nhất 8 ký tự.");
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error("Mật khẩu tối đa 128 ký tự.");
  }
  return password;
}

function createToken(user) {
  const configError = getAuthConfigError();
  if (configError) throw new Error(configError);

  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      displayName: user.displayName || user.username
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

function verifyToken(token) {
  const configError = getAuthConfigError();
  if (configError) throw new Error(configError);
  return jwt.verify(token, config.jwtSecret);
}

function assertTokenNotRevoked(user, payload) {
  if (!user?.password_changed_at || !payload?.iat) {
    return;
  }

  const tokenIssuedAt = payload.iat * 1000;
  const passwordChangedAt = new Date(user.password_changed_at).getTime();
  if (tokenIssuedAt < passwordChangedAt) {
    throw new Error("Phiên đăng nhập không hợp lệ.");
  }
}

function toAuthUser(row) {
  return userRepository.toPublicUser(row);
}

async function register({ username, email, password, confirmPassword }, req = null) {
  const cleanedUsername = validateUsername(username);
  const cleanedEmail = validateEmail(email);
  validatePassword(password);

  if (password !== confirmPassword) {
    throw new Error("Mật khẩu xác nhận không khớp.");
  }

  if (await userRepository.findByUsername(cleanedUsername)) {
    throw new Error("Username đã tồn tại.");
  }

  if (cleanedEmail && (await userRepository.findByEmail(cleanedEmail))) {
    throw new Error("Email đã được sử dụng.");
  }

  const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);
  const user = await userRepository.createUser({
    username: cleanedUsername,
    email: cleanedEmail,
    passwordHash,
    displayName: cleanedUsername
  });

  await auditService.log({
    actorId: user.id,
    actorRole: user.role,
    action: "auth.register",
    targetType: "user",
    targetId: user.id,
    req
  });

  return user;
}

async function login({ usernameOrEmail, password }, req = null) {
  const identifier = String(usernameOrEmail || "").trim();
  validatePassword(password);

  if (!identifier) {
    throw new Error("Vui lòng nhập username hoặc email.");
  }

  const user = await userRepository.findByUsernameOrEmail(identifier);
  if (!user) {
    throw new Error(LOGIN_ERROR);
  }

  if (user.is_locked) {
    throw new Error("Tài khoản đã bị khóa.");
  }

  if (user.status !== "active") {
    throw new Error("Tài khoản không khả dụng.");
  }

  const valid = await argon2.verify(user.password_hash, password);
  if (!valid) {
    throw new Error(LOGIN_ERROR);
  }

  await userRepository.updateLastSeen(user.id);
  const publicUser = toAuthUser(user);

  await auditService.log({
    actorId: user.id,
    actorRole: user.role,
    action: "auth.login",
    targetType: "user",
    targetId: user.id,
    req
  });

  return publicUser;
}

async function getUserFromToken(token) {
  const payload = verifyToken(token);
  const user = await userRepository.findById(payload.sub);
  if (!user) {
    throw new Error("Phiên đăng nhập không hợp lệ.");
  }

  if (user.is_locked || user.status !== "active") {
    throw new Error("Phiên đăng nhập không hợp lệ.");
  }

  assertTokenNotRevoked(user, payload);
  return toAuthUser(user);
}

module.exports = {
  getAuthConfigError,
  createToken,
  verifyToken,
  assertTokenNotRevoked,
  register,
  login,
  getUserFromToken,
  toAuthUser,
  validateUsername,
  validateEmail,
  validatePassword,
  ARGON2_OPTIONS,
  LOGIN_ERROR
};