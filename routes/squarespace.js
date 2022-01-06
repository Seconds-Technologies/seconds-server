const express = require("express");
const { connect, authorize } = require('../helpers/squarespace');
const router = express.Router();

router.post('/', connect)
router.post('/authorize', authorize)

module.exports = router;