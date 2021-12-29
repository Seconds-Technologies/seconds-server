const express = require("express");
const { getCredentials, authorizeWoocommerceAccount } = require('../helpers/woocommerce');
const router = express.Router();

router.get('/', getCredentials)
router.post("/authorize", authorizeWoocommerceAccount);

module.exports = router;