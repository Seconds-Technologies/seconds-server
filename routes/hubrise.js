const express = require('express');
const db = require('../models');
const axios = require('axios');
const querystring = require('querystring');
const moment = require('moment');
const router = express.Router();

router.get('/', async (req, res, next) => {
	try {
		const { email } = req.query;
		const user = await db.User.findOne({ email });
		if (user) {
			// fetch the hubrise catalog
			const hubrise = await db.Hubrise.findOne({ clientId: user['_id'] });
			const catalog = await db.Catalog.findOne({ clientId: user['_id'] });
			if (hubrise) {
				let { accessToken, options, ...credentials } = hubrise.toObject();
				const payload = { credentials, options, catalog };
				console.log(payload);
				res.status(200).json(payload);
			} else {
				throw new Error('This user has no hubrise account integrated');
			}
		} else {
			throw new Error(`No user found with email address ${email}`);
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
				account_name: `${user.firstname} ${user.lastname}`
			};
			const query_string = querystring.stringify(params).replace(/%20/g, '+');
			console.log('query params', query_string);
			const URL = 'https://manager.hubrise.com/oauth2/v1/authorize' + '?' + query_string;
			res.redirect(URL);
		} else {
			let error = new Error(`User with email ${email} could not be found`);
			error.status = 404;
			throw error;
		}
	} catch (err) {
		if (err.response) console.log(err.response.data);
		else console.error('ERROR', err);
		res.redirect(303, `${process.env.CLIENT_HOST}/integrate/hubrise?success=0&error=${err.message}`);
	}
});

router.get('/connect', async (req, res, next) => {
	try {
		const { code, email } = req.query;
		const user = await db.User.findOne({ email: email }, { hubrise: 1 });
		console.log(user);
		// use credentials to retrieve hubrise access token
		let URL = `${process.env.HUBRISE_MANAGER_BASE_URL}/token`;
		const params = {
			code,
			client_id: process.env.HUBRISE_CLIENT_ID,
			client_secret: process.env.HUBRISE_CLIENT_SECRET
		};
		let result = (await axios.post(URL, null, { params })).data;
		console.log('--------------------------');
		console.log('Account Credentials');
		console.table(result);
		const hubriseUser = await db.Hubrise.create({
			active: true,
			clientId: user['_id'],
			accessToken: result.access_token,
			accountName: result.account_name,
			accountId: result.account_id,
			locationName: result.location_name,
			locationId: result.location_id,
			catalogId: result.catalog_id,
			catalogName: result.catalog_name
		});
		// create webhook subscription
		URL = `${process.env.HUBRISE_API_BASE_URL}/callback`;
		const payload = {
			url: `${process.env.API_HOST}/api/v1/hubrise`,
			events: {
				order: ['create', 'update'],
				location: ['update']
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
		const { accessToken, ...hubrise } = hubriseUser.toObject();
		res.status(200).json(hubrise);
	} catch (err) {
		if (err.response.data) {
			console.log(err.response.data);
			return err.response.data.message
				? next({
						status: err.response.status,
						message: err.response.data.message
				  })
				: next({
						status: err.response.status,
						message: err.response.data['error_type']
				  });
		} else {
			console.error('ERROR', err);
			res.status(500).json({ message: err.message });
		}
	}
});

router.patch('/disconnect', async (req, res, next) => {
	try {
		const { email } = req.body;
		const user = await db.User.findOne({ email });
		if (user) {
			const hubrise = await db.User.findOne({ clientId: user['_id'] });
			if (hubrise) {
				// delete the hubrise callback
				let config = {
					headers: {
						'X-Access-Token': hubrise['accessToken']
					}
				};
				const URL = `${process.env.HUBRISE_API_BASE_URL}/callback`;
				const result = (await axios.delete(URL, config)).data;
				console.log('-----------------------------------------------');
				console.log(result);
				console.log('-----------------------------------------------');
				// delete catalogs from the db belonging to the user
				await db.Catalog.deleteMany({ clientId: user['_id'] });
				// delete hubrise user from the db
				await db.Hubrise.findOneAndDelete({ clientId: user['_id'] });
				res.status(200).json({ message: 'Hubrise account has been disconnected' });
			} else {
				return next({
					status: 404,
					message: `User has no hubrise account integrated`
				});
			}
		} else {
			return next({
				status: 404,
				message: `User with email ${email} could not be found`
			});
		}
	} catch (err) {
		if (err.response && err.response.data) {
			console.log(err.response.data);
			return err.response.data.message
				? next({
						status: err.response.status,
						message: err.response.data.message
				  })
				: next({
						status: err.response.status,
						message: err.response.data['error_type']
				  });
		} else {
			console.error('ERROR', err);
			res.status(500).json({ message: err.message });
		}
	}
});

router.patch('/update-hubrise', async (req, res, next) => {
	try {
		const { email } = req.query;
		console.table(req.body);
		const user = await db.User.findOne({ email });
		if (user) {
			const hubrise = await db.Hubrise.findOne({ clientId: user['_id'] });
			if (hubrise) {
				hubrise.options = req.body;
				await hubrise.save();
				res.status(200).json({ message: 'Hubrise updated successfully' });
			} else {
				return next({
					status: 404,
					message: `User has no hubrise account integrated`
				});
			}
		} else {
			return next({
				status: 404,
				message: `User with email ${email} could not be found`
			});
		}
	} catch (err) {
		console.error('ERROR', err);
		res.status(500).json({ message: err.message });
	}
});

router.get('/pull-catalog', async (req, res, next) => {
	try {
		const { email } = req.query;
		const user = await db.User.findOne({ email });
		console.log('USER:', !!user);
		let CATALOG;
		let CATALOG_ID;
		let CATALOG_NAME;
		if (user) {
			const hubrise = await db.Hubrise.findOne({ clientId: user['_id'] });
			if (hubrise) {
				let { locationId, catalogId, accessToken } = hubrise.toObject();
				const catalogEndpoint = `catalogs/${catalogId}`;
				const catalogURL = process.env.HUBRISE_API_BASE_URL + catalogEndpoint;
				console.table({ catalogURL });
				const config = {
					headers: {
						'X-Access-Token': accessToken
					}
				};
				// fetch the catalog with hubrise catalogID
				let catalog = (await axios.get(catalogURL, config)).data;
				console.log('-----------------------------------------------');
				console.log(catalog);
				console.log('-----------------------------------------------');
				if (catalog) {
					// push catalog into the database
					let categories = catalog.data.categories.map(
						({ id, name, ref, description, parent_ref, tags }) => ({
							categoryId: id,
							name,
							ref,
							description,
							parentRef: parent_ref,
							tags
						})
					);
					let products = catalog.data.products.map(
						({ id, name, description, skus, category_id, tags, ref }, index) => {
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
						}
					);
					CATALOG = {
						clientId: user['_id'],
						hubriseId: hubrise['_id'],
						locationId,
						catalogId: id,
						catalogName: name,
						products,
						categories
					};
					console.log(CATALOG);
					await db.Catalog.create(CATALOG);
					CATALOG_ID = catalog.id;
					CATALOG_NAME = catalog.name;
				}
				res.status(200).json({
					message: 'Catalog pulled successfully!',
					catalog: CATALOG,
					catalogId: CATALOG_ID,
					catalogName: CATALOG_NAME
				});
			} else {
				let error = new Error(`This user has no hubrise account integrated`);
				error.status = 404;
				throw error;
			}
		} else {
			let error = new Error(`User with email ${email} could not be found`);
			error.status = 404;
			throw error;
		}
	} catch (err) {
		if (err.response && err.response.data) {
			console.log(err.response.data);
			return err.response.data.message
				? next({
						status: err.response.status,
						message: err.response.data.message
				  })
				: next({
						status: err.response.status,
						message: err.response.data['error_type']
				  });
		} else {
			console.error('ERROR', err);
			res.status(500).json({ message: err.message });
		}
	}
});

router.get('/fetch-catalog', async (req, res) => {
	try {
	} catch (err) {
		console.error(err);
	}
});

router.patch('/update-catalog', async (req, res) => {
	try {
		const { email } = req.query;
		const data = req.body;
		console.log(data);
		const user = await db.User.findOne({ email: email });
		if (user) {
			const catalog = await db.Catalog.find({ clientId: user['_id'] });
			if (catalog) {
				// find the matching variant ref to update
				for (let item of data) {
					catalog['products'].forEach(({ variants }, productIdx) => {
						variants.forEach(({ ref }, variantIdx) => {
							if (ref === item.id) {
								catalog['products'][productIdx].variants[variantIdx].weight = item.value;
								console.log(`New weight assigned to product variant ${ref}`);
							}
						});
					});
				}
				await catalog.save();
				catalog['products'].forEach(prod =>
					prod.variants.forEach(({ ref, weight }) =>
						console.table({
							ref,
							weight
						})
					)
				);
				res.status(200).json({ message: 'Catalog updated successfully!', catalog });
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
});

module.exports = router;
