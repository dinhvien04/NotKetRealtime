const express = require("express");
const healthController = require("../controllers/health.controller");

const router = express.Router();

router.get("/", healthController.health);
router.get("/db", healthController.db);
router.get("/live", healthController.live);
router.get("/ready", healthController.ready);

module.exports = router;
