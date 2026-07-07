const express = require("express");
const pageController = require("../controllers/page.controller");
const { requireAuthPage } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/", pageController.showHome);
router.get("/chat", requireAuthPage, pageController.showChat);

module.exports = router;