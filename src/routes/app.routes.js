const express = require("express");
const appController = require("../controllers/app.controller");

const router = express.Router();

router.get("/config", appController.getConfig);

module.exports = router;
