const express = require("express");
const documentMessageController = require("../controllers/document-message.controller");

const router = express.Router();

router.get("/", documentMessageController.list);
router.post("/", documentMessageController.createText);
router.post("/file", documentMessageController.createFile);
router.delete("/:id", documentMessageController.remove);

module.exports = router;
