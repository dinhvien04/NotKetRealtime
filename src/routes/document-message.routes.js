const express = require("express");
const documentMessageController = require("../controllers/document-message.controller");
const {
  messageReadLimiter,
  messageWriteLimiter
} = require("../middlewares/rate-limit.middleware");

const router = express.Router();

router.get("/", messageReadLimiter, documentMessageController.list);
router.post("/", messageWriteLimiter, documentMessageController.createText);
router.post("/file", messageWriteLimiter, documentMessageController.createFile);
router.delete("/:id", messageWriteLimiter, documentMessageController.remove);

module.exports = router;
