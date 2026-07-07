const express = require("express");
const { issueCsrfToken } = require("../middlewares/csrf.middleware");
const { optionalAuth } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/csrf-token", optionalAuth, issueCsrfToken);

module.exports = router;