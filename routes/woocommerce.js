const express = require("express");
const { authorizeWoocommerceAccount } = require('../helpers/woocommerce');
const router = express.Router();

router.post("/authorize", authorizeWoocommerceAccount);

module.exports = router;