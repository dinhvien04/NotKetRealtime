const profileService = require("../services/profile.service");
const userRepository = require("../repositories/user.repository");
const { getSupabaseError } = require("../services/supabase.service");
const { uploadAvatar } = require("../services/storage.service");
const { getDatabaseError } = require("../db");

async function getMe(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const user = await profileService.getProfile(req.user.id);
    return res.json({ ok: true, user });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể tải hồ sơ."
    });
  }
}

async function updateMe(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const user = await profileService.updateProfile(
      req.user.id,
      req.body || {},
      req
    );
    return res.json({ ok: true, user });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể cập nhật hồ sơ."
    });
  }
}

async function uploadMyAvatar(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  const configError = getSupabaseError();
  if (configError) {
    return res.status(503).json({ ok: false, error: configError });
  }

  if (!req.file) {
    return res.status(400).json({ ok: false, error: "Thiếu ảnh upload." });
  }

  try {
    const uploaded = await uploadAvatar({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      size: req.file.size,
      userId: req.user.id
    });

    const user = await profileService.updateAvatar(
      req.user.id,
      uploaded.avatarUrl,
      req
    );

    return res.json({ ok: true, user, avatar: uploaded });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể upload ảnh đại diện."
    });
  }
}

async function changePassword(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    await profileService.changePassword(req.user.id, req.body || {}, req);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể đổi mật khẩu."
    });
  }
}

async function searchUsers(req, res) {
  const dbError = getDatabaseError();
  if (dbError) {
    return res.status(503).json({ ok: false, error: dbError });
  }

  try {
    const users = await userRepository.searchUsers(req.query.q, {
      excludeUserId: req.user.id,
      limit: req.query.limit
    });
    return res.json({ ok: true, users });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Không thể tìm người dùng."
    });
  }
}

module.exports = {
  getMe,
  updateMe,
  uploadMyAvatar,
  changePassword,
  searchUsers
};