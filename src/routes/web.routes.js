const express = require("express");
const pageController = require("../controllers/page.controller");

const router = express.Router();

router.get("/", pageController.showHome);
router.get("/chat", pageController.showChat);

module.exports = router;
