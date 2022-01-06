const express = require("express");
const { connect, authorize } = require('../helpers/squarespace');
const router = express.Router();

router.get('/', connect)
router.post('/authorize', authorize)

module.exports = router;