const express = require("express");
const pageController = require("../controllers/page.controller");
const { requireAuthPage, requireStaffPage } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/", pageController.showHome);
router.get("/chat", requireAuthPage, pageController.showChat);
router.get("/admin", requireStaffPage, pageController.showAdmin);

module.exports = router;