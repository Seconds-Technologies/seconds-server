const express = require("express");
const router = express.Router();

const {
	connectShopify,
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
router.post("/connect", connectShopify);
router.post("/count-orders", getOrderCount);
router.post("/all-products", getShopifyProducts);
router.post("/product-image", getProductImage);
router.post("/fetch-products", fetchProducts);
router.put("/update-order", updateOrder)
router.put("/update-product", updateProduct)
router.post("/delete-product", removeProduct);

module.exports = router;