const express = require("express");
const storageController = require("../controllers/storage.controller");

const router = express.Router();

router.get("/usage", storageController.usage);

module.exports = router;
