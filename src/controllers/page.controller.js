const path = require("path");

/** HTML shell must not be cached long — deploys should pick up new asset hashes immediately. */
function setHtmlNoStore(res) {
  res.setHeader("Cache-Control", "no-store");
}

function home(req, res) {
  setHtmlNoStore(res);
  return res.sendFile(path.join(__dirname, "..", "..", "views", "home.html"));
}

function documents(req, res) {
  setHtmlNoStore(res);
  return res.sendFile(path.join(__dirname, "..", "..", "views", "documents.html"));
}

module.exports = {
  home,
  documents
};
