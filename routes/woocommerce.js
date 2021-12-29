const express = require("express");
const { getCredentials, authorizeWoocommerceAccount } = require('../helpers/woocommerce');
const router = express.Router();

router.post('/', getCredentials)
router.post("/authorize", authorizeWoocommerceAccount);

module.exports = router;