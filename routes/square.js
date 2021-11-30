const express = require("express");
const { authorizeSquareAccount, getCredentials } = require('../helpers/square');
const router = express.Router();

router.get("/", getCredentials)
router.post("/authorize", authorizeSquareAccount);

module.exports = router;