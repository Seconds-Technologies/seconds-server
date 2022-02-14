const express = require("express");
const { verifyDriver, login } = require('../helpers/driver');
const router = express.Router();

router.post('/verify', verifyDriver)
router.post('/login', login)

module.exports = router;