const express = require("express");
const uploadController = require("../controllers/upload.controller");

const router = express.Router();

router.post("/sign", uploadController.sign);
router.post("/refresh-url", uploadController.refreshUrl);

module.exports = router;
