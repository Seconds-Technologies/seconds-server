const express = require("express");
const { getCredentials, connect, authorize } = require('../helpers/squarespace');
const router = express.Router();

router.get('/', getCredentials)
router.get('/connect', connect)
router.post('/authorize', authorize)

module.exports = router;