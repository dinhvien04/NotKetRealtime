const config = require("../config/env");
const iconService = require("../services/icon.service");

function getConfig(req, res) {
  return res.json({
    ok: true,
    allowedPrefixes: config.iconAllowedPrefixes,
    defaultPrefix: config.iconDefaultPrefix,
    maxRecent: config.iconMaxRecent,
    maxSearchResults: config.iconMaxSearchResults
  });
}

async function getRecent(req, res, next) {
  try {
    const icons = await iconService.listRecentIcons(req.user.id);
    return res.json({ ok: true, icons });
  } catch (error) {
    return next(error);
  }
}

async function saveRecent(req, res, next) {
  try {
    const icon = await iconService.rememberIcon(
      req.user.id,
      req.body.iconName,
      req.body.color
    );
    return res.json({ ok: true, icon });
  } catch (error) {
    return next(error);
  }
}

async function search(req, res, next) {
  try {
    const icons = await iconService.searchIconSuggestions({
      query: req.query.q || "",
      prefix: req.query.prefix || "",
      limit: req.query.limit
    });
    return res.json({ ok: true, icons });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getConfig,
  getRecent,
  saveRecent,
  search
};