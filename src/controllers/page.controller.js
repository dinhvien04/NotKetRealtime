const path = require("path");

function sendView(fileName) {
  return (req, res) => {
    res.sendFile(path.join(__dirname, "..", "..", "views", fileName));
  };
}

module.exports = {
  showHome: sendView("index.html"),
  showChat: sendView("chat.html"),
  showAdmin: sendView("admin.html")
};
