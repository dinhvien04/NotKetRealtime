const express = require("express");
const { issueCsrfToken } = require("../middlewares/csrf.middleware");

const router = express.Router();

router.get("/csrf-token", issueCsrfToken);

module.exports = router;