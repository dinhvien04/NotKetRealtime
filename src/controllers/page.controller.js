const path = require("path");

function home(req, res) {
  return res.sendFile(path.join(__dirname, "..", "..", "views", "home.html"));
}

function documents(req, res) {
  return res.sendFile(path.join(__dirname, "..", "..", "views", "documents.html"));
}

module.exports = {
  home,
  documents
};
