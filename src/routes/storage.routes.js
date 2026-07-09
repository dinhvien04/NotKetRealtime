const express = require("express");
const storageController = require("../controllers/storage.controller");

const router = express.Router();

router.get("/usage", storageController.usage);
router.post("/cleanup", storageController.cleanup);

module.exports = router;
