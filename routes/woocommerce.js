const express = require("express");
const { callback, getWooCommerceDetails, authorizeWoocommerceAccount } = require('../helpers/woocommerce');
const router = express.Router();

router.get('/', getWooCommerceDetails)
router.post('/callback', callback)
router.post("/authorize", authorizeWoocommerceAccount);

module.exports = router;