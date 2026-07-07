const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const config = require("../config/env");
const userRepository = require("../repositories/user.repository");
const { sanitizeUsername } = require("../utils/sanitize");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getAuthConfigError() {
  if (!config.jwtSecret) {
    return "Thiếu JWT_SECRET. Vui lòng cấu hình biến môi trường JWT_SECRET.";
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

function toAuthUser(row) {
  return userRepository.toPublicUser(row);
}

async function register({ username, email, password, confirmPassword }) {
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

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id
  });

  return userRepository.createUser({
    username: cleanedUsername,
    email: cleanedEmail,
    passwordHash,
    displayName: cleanedUsername
  });
}

async function login({ usernameOrEmail, password }) {
  const identifier = String(usernameOrEmail || "").trim();
  validatePassword(password);

  if (!identifier) {
    throw new Error("Vui lòng nhập username hoặc email.");
  }

  const user = await userRepository.findByUsernameOrEmail(identifier);
  if (!user) {
    throw new Error("Thông tin đăng nhập không chính xác.");
  }

  const valid = await argon2.verify(user.password_hash, password);
  if (!valid) {
    throw new Error("Thông tin đăng nhập không chính xác.");
  }

  return toAuthUser(user);
}

async function getUserFromToken(token) {
  const payload = verifyToken(token);
  const user = await userRepository.findById(payload.sub);
  if (!user) {
    throw new Error("Phiên đăng nhập không hợp lệ.");
  }
  return toAuthUser(user);
}

module.exports = {
  getAuthConfigError,
  createToken,
  verifyToken,
  register,
  login,
  getUserFromToken,
  toAuthUser,
  validateUsername,
  validateEmail,
  validatePassword
};