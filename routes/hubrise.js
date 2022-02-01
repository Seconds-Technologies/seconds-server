const express = require('express');
const db = require('../models');
const axios = require('axios');
const querystring = require('querystring');
const moment = require('moment');
const router = express.Router();

const BASE_URL = 'https://api.hubrise.com/v1';

router.get('/', async (req, res, next) => {
	try {
		const { email } = req.query;
		const { hubrise } = await db.User.findOne({ email });
		console.log(hubrise);
		if (hubrise.accessToken) {
			res.status(200).json(hubrise);
		} else {
			throw new Error('This user has no hubrise account integrated');
		}
	} catch (err) {
		console.error(err);
		return next({
			status: 404,
			message: 'Unable to retrieve hubrise details'
		});
	}
});

router.post('/authorize', async (req, res) => {
	try {
		const { email } = req.body;
		const user = await db.User.findOne({ email });
		if (user) {
			const params = {
				redirect_uri: `${process.env.CLIENT_HOST}/integrate/hubrise`,
				client_id: `${process.env.HUBRISE_CLIENT_ID}`,
				scope: `${process.env.HUBRISE_SCOPES}`,
				country: 'UK',
				account_name: `${user.firstname} ${user.lastname}`,
				location_name: user.address.city
			};
			const query_string = querystring.stringify(params).replace(/%20/g, '+');
			console.log('query params', query_string);
			const URL = 'https://manager.hubrise.com/oauth2/v1/authorize' + '?' + query_string;
			// const URL = `https://manager.hubrise.com/oauth2/v1/authorize?redirect_uri=${process.env.CLIENT_HOST}/integrate/hubrise&client_id=${process.env.HUBRISE_CLIENT_ID}&scope=${process.env.HUBRISE_SCOPES}`;
			res.redirect(URL);
		} else {
			let error = new Error(`User with email ${email} could not be found`);
			error.status = 404;
			throw error;
		}
	} catch (err) {
		if (err.response) {
			console.log(err.response.data);
		} else {
			console.error('ERROR', err);
		}
		res.redirect(303, `${process.env.CLIENT_HOST}/integrate/hubrise?success=0&error=${err.message}`);
	}
});

router.get('/connect', async (req, res) => {
	try {
		const { code, email } = req.query;
		const user = await db.User.findOne({ email: email }, { hubrise: 1 });
		console.log(user);
		// use credentials to retrieve hubrise access token
		let URL = 'https://manager.hubrise.com/oauth2/v1/token';
		const params = {
			code,
			client_id: process.env.HUBRISE_CLIENT_ID,
			client_secret: process.env.HUBRISE_CLIENT_SECRET
		};
		let result = (await axios.post(URL, null, { params })).data;
		console.log('--------------------------');
		console.log('Account Credentials');
		console.table(result);
		// append access token + location_id to hubrise property of the user document
		user['hubrise'].accessToken = result.access_token;
		user['hubrise'].accountName = result.account_name;
		user['hubrise'].locationName = result.location_name;
		user['hubrise'].locationId = result.location_id;
		user['hubrise'].catalogName = result.catalog_name;
		user['hubrise'].catalogId = result.catalog_id;
		user['hubrise'].customerListName = result.customer_list_name;
		user['hubrise'].customerListId = result.customer_list_id;
		await user.save();
		// create webhook subscription
		URL = 'https://api.hubrise.com/v1/callback';
		const payload = {
			url: `${process.env.API_HOST}/hubrise`,
			events: {
				order: ['create', 'update']
			}
		};
		let config = {
			headers: {
				'X-Access-Token': result.access_token
			}
		};
		const webhook = process.env.NODE_ENV === 'production' ? (await axios.post(URL, payload, config)).data : null;
		console.log('--------------------------');
		console.log('Hubrise Webhook');
		console.table(webhook);
		console.log('--------------------------');
		const { accessToken, ...hubrise } = user['hubrise'];
		res.status(200).json(hubrise);
	} catch (err) {
		if (err.response) {
			console.log(err.response.data);
		} else {
			console.error('ERROR', err);
		}
		res.status(500).json({ message: err.message });
	}
});

router.patch('/disconnect', async (req, res, next) => {
	try {
		const { email } = req.body;
		const user = await db.User.findOneAndUpdate(
			{ email: email },
			{
				'hubrise.accessToken': undefined,
				'hubrise.accountName': undefined,
				'hubrise.locationName': undefined,
				'hubrise.locationId': undefined,
				'hubrise.catalogName': undefined,
				'hubrise.catalogId': undefined,
				'hubrise.customerListName': undefined,
				'hubrise.customerListId': undefined
			},
			{ new: true }
		);
		if (user) {
			console.log(user['hubrise']);
			return res.status(200).json({ message: 'Hubrise account has been disconnected' });
		} else {
			let error = new Error(`User with email ${email} could not be found`);
			error.status = 404;
			throw error;
		}
	} catch (err) {
		if (err.response) {
			console.log(err.response.data);
		} else {
			console.error('ERROR', err);
		}
		res.status(500).json({ message: err.message });
	}
});

router.get('/pull-catalog', async (req, res) => {
	try {
		const { email } = req.query;
		const user = await db.User.findOne({ email });
		console.log('USER:', !!user);
		let CATALOG;
		const HUBRISE_CATALOGS = [];
		if (user) {
			let { locationId } = user['hubrise'];
			const locationEndpoint = `/locations/${locationId}/catalogs`;
			const locationURL = BASE_URL + locationEndpoint;
			console.table({ locationURL });
			const config = {
				headers: {
					'X-Access-Token': user['hubrise'].accessToken
				}
			};
			// fetch catalogs under the connected hubrise location
			let catalogs = (await axios.get(locationURL, config)).data;
			console.log('LOCATION:', catalogs);
			console.log('-----------------------------------------');
			// check if there are any catalogs listed, if there are find the with matching location ID and retrieve it
			// if not skip and search for account level catalogs
			if (catalogs.length) {
				let catalogRef = catalogs.find(({ location_id }) => location_id === locationId);
				let URL = BASE_URL + `/catalogs/${catalogRef.id}`;
				const catalog = (await axios.get(URL, config)).data;
				console.log(catalog);
				HUBRISE_CATALOGS.push(catalog);
			}
			// push catalogs into the database
			await Promise.all(
				HUBRISE_CATALOGS.map(async ({ id, name, data, location_id }) => {
					let categories = data.categories.map(({ id, name, ref, description, parent_ref, tags }) => ({
						categoryId: id,
						name,
						ref,
						description,
						parentRef: parent_ref,
						tags
					}));
					let products = data.products.map(({ name, description, skus, category_id, tags, ref }, index) => {
						console.log(`PRODUCT: #${index}`);
						//console.table({ id, name, description, skus, category_ref, tags, ref });
						let variants = skus.map(
							({ id, name, product_id, price, ref, tags, option_list_ids }, index) => {
								console.log(`VARIANT: #${index}`);
								/*console.table({
									id,
									name,
									product_id,
									price: Number(price.split(' ')[0]).toFixed(2),
									ref,
									tags,
									option_list_ids
								});*/
								return {
									variantId: id,
									name,
									price: Number(price.split(' ')[0]).toFixed(2),
									ref,
									productId: product_id,
									tags,
									options: option_list_ids
								};
							}
						);
						return {
							productId: id,
							name,
							description,
							categoryId: category_id,
							tags,
							variants
						};
						// for each product, store the sku id, product id, sku name, product name, categoryRef, description
					});
					const catalog = {
						clientId: user['_id'],
						locationId: location_id,
						catalogId: id,
						catalogName: name,
						products,
						categories
					};
					console.log(catalog)
					CATALOG = await db.Catalog.create(catalog);
					CATALOG = catalog
				})
			);
			res.status(200).json({
				message: "Catalog pulled successfully!",
				catalog: CATALOG
			});
		} else {
			let error = new Error(`User with email ${email} could not be found`);
			error.status = 404;
			throw error;
		}
	} catch (err) {
		if (err.response) {
			console.log(err.response.data);
		} else {
			console.error('ERROR', err);
		}
		res.status(500).json({ message: err.message });
	}
});

router.get('/fetch-catalog', async (req, res) => {
	try {

	} catch (err) {
	    console.error(err)
	}
})

router.post('/update-catalog', async (req, res) => {
	try {
		const { email } = req.query;
		const { data } = req.body
		console.log(data)
		const user = await db.User.findOne({ email: email })
		if (user) {
			const catalog = await db.Catalog.findOne({clientId: user['_id']})
			if (catalog) {
				// find the matching variant ref to update
				for (let item of data) {
					catalog['products'].forEach(({ variants }, productIdx) => {
						variants.forEach(({ ref }, variantIdx) => {
							if (ref === item.id) {
								catalog.products[productIdx].variants[variantIdx].weight = item.value
								console.log(`New weight assigned to product variant ${ref}`)
							}
						})
					})
				}
				await catalog.save()
				catalog.products.forEach(prod => prod.variants.forEach(({ref, weight}) => console.table({ ref, weight})))
				res.status(200).json({message: "Catalog updated successfully!", catalog})
			} else {
				let error = new Error(`The user with email ${email} has no associated catalog`);
				error.status = 404;
				throw error;
			}
		} else {
			let error = new Error(`User with email ${email} could not be found`);
			error.status = 404;
			throw error;
		}
	} catch (err) {
		if (err.response) {
			console.log(err.response.data);
		} else {
			console.error('ERROR', err);
		}
		res.status(500).json({ message: err.message });
	}
})

module.exports = router;
