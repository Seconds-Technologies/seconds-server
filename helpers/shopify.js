require("dotenv").config();
const express = require("express");
const db = require("../models/index");
const axios = require("axios");
const moment = require("moment-timezone");
const { filterAndUpdateProducts, filterAndRemove, filterOrders, updateOrders, updateStatuses } = require("./helpers");

exports.validateShopify = async (req, res, next) => {
	try {
		console.log(req.body);
		const { email, shopName, apiKey, password } = req.body;
		const baseURL = `https://${shopName}.myshopify.com/admin/api/2021-04`;
		const URL = `https://${apiKey}:${password}@${shopName}.myshopify.com/admin/api/2021-04/shop.json`;
		//const buff = Buffer.from(`${apiKey}:${password}`, 'utf-8');
		// const authToken = String("Basic " + buff.toString('base64'));
		const {
			data: {
				shop: { id, domain, country, shop_owner },
			},
		} = await axios.get(URL);
		//check if a user has an account integrated with this shopify account already
		const users = await db.User.find({"shopDetails.shopId": id})
		console.log("Duplicate shopify users", users.length)
		if (!users.length) {
			await db.User.findOneAndUpdate(
				{ email },
				{ shopDetails: { baseURL, accessToken: password, shopId: id, domain, country, shopOwner: shop_owner } },
				{ new: true }
			);		// append the shop id to user mongo
			return res.status(200).json({
				shopId: id,
				domain,
				country,
				shopOwner: shop_owner,
				baseURL,
				accessToken: password,
			});
		} else {
			throw new Error("There is already an account connected to that shopify store!");
		}
	} catch (err) {
		console.error(err);
		return next({
			status: 401,
			message: err.message,
		});
	}
};

exports.getShopifyDetails = async (req, res, next) => {
	try {
		console.log(req.body);
		let { email } = req.body;
		let { shopDetails } = await db.User.findOne({ email });
		console.log(shopDetails);
		if (shopDetails.accessToken || shopDetails.shopId) {
			res.status(200).json({
				...shopDetails,
			});
		} else {
			throw new Error("This user has no shopify account integrated");
		}
	} catch (err) {
		console.error(err);
		return next({
			status: 404,
			message: "Unable to retrieve shopify details",
		});
	}
};

exports.getOrderCount = async (req, res, next) => {
	try {
		const { baseURL, token } = req.body;
		const url = baseURL + "/orders/count.json";
		console.log(url);
		console.log(token);
		const {
			data: { count },
		} = await axios.get(url, {
			headers: {
				"X-Shopify-Access-Token": token,
			},
		});
		res.status(200).json({
			count,
		});
	} catch (e) {
		console.error(e);
		return next({
			status: 404,
			message: "Unable to get shop orders!",
		});
	}
};

exports.getShopifyOrders = async (req, res, next) => {
	try {
		const { baseURL, token, email, createdAt } = req.body;
		let date = moment(createdAt).startOf("hour").toISOString();
		let dataEdt = moment(date).subtract(3, "years").tz("America/New_York").format();
		console.log(dataEdt);
		const url = baseURL + `/orders.json?created_at_min=${dataEdt}&status=any`;
		console.log(url, token, email);
		const {
			data: { orders: shopifyOrders },
		} = await axios.get(url, {
			headers: {
				"X-Shopify-Access-Token": token,
			},
		});
		console.log("Number of orders:", shopifyOrders.length);
		const postcodes = (await db.PostCode.find()).map(item => item['Postcode']);
		let filteredOrders = filterOrders(shopifyOrders, postcodes);
		const {
			shopDetails: { orders: dbOrders },
		} = await db.User.findOne({ email }, "shopDetails.orders");
		// check if there are any orders in the database
		// compare shopify orders with orders in db
		// if order ids match, update order status with order status stored in db
		let finalOrders = dbOrders.length > 0 ? updateStatuses(filteredOrders, dbOrders) : filteredOrders
		await db.User.findOneAndUpdate({ email }, { "shopDetails.orders": finalOrders }, { new: true });
		res.status(200).json({
			postcodes,
			orders: finalOrders,
		});
	} catch (e) {
		console.error(e);
		return next({
			status: 404,
			message: "Unable to get shop orders!",
		});
	}
};

exports.getShopifyProducts = async (req, res, next) => {
	try {
		const { baseURL, token, email } = req.body;
		const url = baseURL + `/products.json`;
		console.log(url);
		console.log(token);
		const {
			data: { products },
		} = await axios.get(url, {
			headers: {
				"X-Shopify-Access-Token": token,
			},
		});
		await db.User.findOneAndUpdate({ email }, { "shopDetails.products": products }, { new: true });
		res.status(200).json({
			products,
		});
	} catch (e) {
		console.error(e);
		return next({
			status: 404,
			message: "Unable to get shop products!",
		});
	}
};

exports.getProductImage = async (req, res, next) => {
	try {
		const { baseURL, accessToken, id } = req.body;
		const url = baseURL + `/products/${id}/images.json`;
		console.log(url, accessToken);
		const {
			data: { images },
		} = await axios.get(url, {
			headers: {
				"X-Shopify-Access-Token": accessToken,
			},
		});
		console.log(images);
		res.status(200).json({
			...images[0],
		});
	} catch (e) {
		console.error(e);
		return next({
			status: 404,
			message: "Unable to get product image!",
		});
	}
};

exports.fetchOrders = async (req, res, next) => {
	try {
		const { email } = req.body;
		const {
			shopDetails: { orders },
		} = await db.User.findOne({ email }, "shopDetails.orders");
		res.status(200).json({
			orders,
		});
	} catch (e) {
		console.error(e);
		return next({
			status: 404,
			message: "Unable to fetch orders from DB!",
		});
	}
};

exports.fetchProducts = async (req, res, next) => {
	try {
		const { email } = req.body;
		const {
			shopDetails: { products },
		} = await db.User.findOne({ email }, "shopDetails.products");
		res.status(200).json({
			products,
		});
	} catch (e) {
		console.error(e);
		return next({
			status: 404,
			message: "Unable to fetch products from DB!",
		});
	}
};

exports.updateOrder = async (req, res, next) => {
	try {
		const { id, email, status } = req.body;
		console.log(req.body);
		const {
			shopDetails: { orders },
		} = await db.User.findOne({ email }, "shopDetails.orders");
		const updatedOrders = updateOrders(orders, id, status);
		await db.User.findOneAndUpdate({ email }, { "shopDetails.orders": updatedOrders }, { new: true });
		res.status(200).json({
			message: `Order ${id} has been updated!`,
			updatedOrders,
		});
	} catch (e) {
		console.error(e);
		return next({
			status: 404,
			message: "Unable to update product!",
		});
	}
};

exports.updateProduct = async (req, res, next) => {
	try {
		const { productId, email, ...keys } = req.body;
		console.log(req.body);
		const {
			shopDetails: { products },
		} = await db.User.findOne({ email }, "shopDetails.products");
		const updatedProducts = filterAndUpdateProducts(products, productId, keys);
		await db.User.findOneAndUpdate({ email }, { "shopDetails.products": updatedProducts }, { new: true });
		res.status(200).json({
			message: `Product ${productId} has been updated!`,
			updatedProducts,
		});
	} catch (e) {
		console.error(e);
		return next({
			status: 404,
			message: "Unable to update product!",
		});
	}
};

exports.removeProduct = async (req, res, next) => {
	try {
		const { email, id } = req.body;
		console.log(req.body);
		const {
			shopDetails: { products },
		} = await db.User.findOne({ email }, "shopDetails.products");
		let updatedProducts = filterAndRemove(products, id);
		await db.User.findOneAndUpdate({ email }, { "shopDetails.products": updatedProducts }, { new: true });
		res.status(200).json({
			message: `Product ${id} has been removed from the store!`,
			updatedProducts,
			count: updatedProducts.length,
		});
	} catch (e) {
		console.error(e);
		return next({
			status: 404,
			message: "Unable to remove product!",
		});
	}
};
