const express = require("express");
const router = express.Router();

const {
	validateShopify,
	getOrderCount,
	getShopifyProducts,
	getShopifyDetails,
	getProductImage,
	fetchProducts,
	updateOrder,
	updateProduct,
	removeProduct,
} = require("../helpers/shopify");

router.post("/", getShopifyDetails)
router.post("/validate", validateShopify);
router.post("/count-orders", getOrderCount);
router.post("/all-products", getShopifyProducts);
router.post("/product-image", getProductImage);
router.post("/fetch-products", fetchProducts);
router.put("/update-order", updateOrder)
router.put("/update-product", updateProduct)
router.post("/delete-product", removeProduct);

module.exports = router;