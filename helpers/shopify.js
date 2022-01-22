require('dotenv').config();
const express = require('express');
const db = require('../models/index');
const axios = require('axios');
const { filterAndUpdateProducts, filterAndRemove, updateOrders } = require('./index');

exports.connectShopify = async (req, res, next) => {
	try {
		const { email, shopName, apiKey, password } = req.body;
		const URL = `https://${apiKey}:${password}@${shopName}.myshopify.com/admin/api/2021-10/shop.json`;
		//const buff = Buffer.from(`${apiKey}:${password}`, 'utf-8');
		// const authToken = String("Basic " + buff.toString('base64'));
		const {
			data: {
				shop: { id, myshopify_domain, country, shop_owner }
			}
		} = await axios.get(URL);
		//check if a user has an account integrated with this shopify account already
		const numUsers = await db.User.where({ 'shopify.shopId': id }).countDocuments();
		console.log('Duplicate shopify users:', numUsers);
		if (!numUsers) {
			// create webhook subscription
			const payload = {
				webhook: {
					topic: 'orders/create',
					address: `${process.env.API_HOST}/api/v1/shopify`,
					format: 'json'
				}
			};
			const webhook = await axios.post(`${myshopify_domain}/admin/api/2021-10/webhooks.json`, payload, { headers: { 'X-Shopify-Access-Token': password } });
			console.log("---------------------------------------")
			console.log(webhook)
			console.log("---------------------------------------")
			await db.User.findOneAndUpdate(
				{ email },
				{
					shopify: {
						accessToken: password,
						shopId: id,
						domain: myshopify_domain,
						country,
						shopOwner: shop_owner
					}
				},
				{ new: true }
			);		// append the shop id to user mongo
			return res.status(200).json({
				shopId: id,
				domain: myshopify_domain,
				country,
				shopOwner: shop_owner,
				accessToken: password
			});
		} else {
			throw new Error('There is already an account connected to that shopify store!');
		}
	} catch (err) {
		console.error(err);
		return next({
			status: 401,
			message: err.message
		});
	}
};

exports.getShopifyDetails = async (req, res, next) => {
	try {
		console.log(req.body);
		let { email } = req.body;
		let { shopify } = await db.User.findOne({ email });
		if (shopify.accessToken || shopify.shopId) {
			res.status(200).json({
				...shopify
			});
		} else {
			throw new Error('This user has no shopify account integrated');
		}
	} catch (err) {
		console.error(err);
		return next({
			status: 404,
			message: 'Unable to retrieve shopify details'
		});
	}
};

exports.getOrderCount = async (req, res, next) => {
	try {
		const { baseURL, token } = req.body;
		const url = baseURL + '/orders/count.json';
		console.log(url);
		console.log(token);
		const {
			data: { count }
		} = await axios.get(url, {
			headers: {
				'X-Shopify-Access-Token': token
			}
		});
		res.status(200).json({
			count
		});
	} catch (e) {
		console.error(e);
		return next({
			status: 404,
			message: 'Unable to get shop orders!'
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
			data: { products }
		} = await axios.get(url, {
			headers: {
				'X-Shopify-Access-Token': token
			}
		});
		await db.User.findOneAndUpdate({ email }, { 'shopify.products': products }, { new: true });
		res.status(200).json({
			products
		});
	} catch (e) {
		console.error(e);
		return next({
			status: 404,
			message: 'Unable to get shop products!'
		});
	}
};

exports.getProductImage = async (req, res, next) => {
	try {
		const { baseURL, accessToken, id } = req.body;
		const url = baseURL + `/products/${id}/images.json`;
		console.log(url, accessToken);
		const {
			data: { images }
		} = await axios.get(url, {
			headers: {
				'X-Shopify-Access-Token': accessToken
			}
		});
		console.log(images);
		res.status(200).json({
			...images[0]
		});
	} catch (e) {
		console.error(e);
		return next({
			status: 404,
			message: 'Unable to get product image!'
		});
	}
};

exports.fetchProducts = async (req, res, next) => {
	try {
		const { email } = req.body;
		const {
			shopify: { products }
		} = await db.User.findOne({ email }, 'shopify.products');
		res.status(200).json({
			products
		});
	} catch (e) {
		console.error(e);
		return next({
			status: 404,
			message: 'Unable to fetch products from DB!'
		});
	}
};

exports.updateOrder = async (req, res, next) => {
	try {
		const { id, email, status } = req.body;
		console.log(req.body);
		const {
			shopify: { orders }
		} = await db.User.findOne({ email }, 'shopify.orders');
		const updatedOrders = updateOrders(orders, id, status);
		await db.User.findOneAndUpdate({ email }, { 'shopify.orders': updatedOrders }, { new: true });
		res.status(200).json({
			message: `Order ${id} has been updated!`,
			updatedOrders
		});
	} catch (e) {
		console.error(e);
		return next({
			status: 404,
			message: 'Unable to update product!'
		});
	}
};

exports.updateProduct = async (req, res, next) => {
	try {
		const { productId, email, ...keys } = req.body;
		console.log(req.body);
		const {
			shopify: { products }
		} = await db.User.findOne({ email }, 'shopify.products');
		const updatedProducts = filterAndUpdateProducts(products, productId, keys);
		await db.User.findOneAndUpdate({ email }, { 'shopify.products': updatedProducts }, { new: true });
		res.status(200).json({
			message: `Product ${productId} has been updated!`,
			updatedProducts
		});
	} catch (e) {
		console.error(e);
		return next({
			status: 404,
			message: 'Unable to update product!'
		});
	}
};

exports.removeProduct = async (req, res, next) => {
	try {
		const { email, id } = req.body;
		console.log(req.body);
		const {
			shopify: { products }
		} = await db.User.findOne({ email }, 'shopify.products');
		let updatedProducts = filterAndRemove(products, id);
		await db.User.findOneAndUpdate({ email }, { 'shopify.products': updatedProducts }, { new: true });
		res.status(200).json({
			message: `Product ${id} has been removed from the store!`,
			updatedProducts,
			count: updatedProducts.length
		});
	} catch (e) {
		console.error(e);
		return next({
			status: 404,
			message: 'Unable to remove product!'
		});
	}
};
