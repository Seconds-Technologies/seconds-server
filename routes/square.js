const express = require("express");
const { validateSquare, getCredentials } = require('../helpers/square');
const router = express.Router();

router.get("/", getCredentials)
router.post("/validate", validateSquare);

module.exports = router;