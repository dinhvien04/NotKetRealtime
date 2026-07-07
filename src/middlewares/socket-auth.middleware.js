const config = require("../config/env");
const authService = require("../services/auth.service");
const userRepository = require("../repositories/user.repository");

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((cookies, part) => {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey) return cookies;
    cookies[rawKey] = decodeURIComponent(rest.join("="));
    return cookies;
  }, {});
}

async function socketAuthMiddleware(socket, next) {
  try {
    const authError = authService.getAuthConfigError();
    if (authError) {
      return next(new Error(authError));
    }

    const cookies = parseCookies(socket.handshake.headers.cookie || "");
    const token =
      cookies[config.cookieName] ||
      (typeof socket.handshake.auth?.token === "string"
        ? socket.handshake.auth.token
        : "");
    if (!token) {
      return next(new Error("Unauthorized"));
    }

    const payload = authService.verifyToken(token);
    const user = await userRepository.findById(payload.sub);
    if (!user || user.is_locked || user.status !== "active") {
      return next(new Error("Unauthorized"));
    }

    authService.assertTokenNotRevoked(user, payload);

    socket.data.user = {
      id: user.id,
      username: user.username,
      displayName: user.display_name || user.username,
      role: user.role || "user"
    };
    return next();
  } catch (error) {
    return next(new Error("Unauthorized"));
  }
}

module.exports = {
  socketAuthMiddleware
};