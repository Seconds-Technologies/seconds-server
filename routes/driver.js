const express = require("express");
const { verifyDriver } = require('../helpers/main');
const router = express.Router();

router.post('/verify', verifyDriver)

module.exports = router;