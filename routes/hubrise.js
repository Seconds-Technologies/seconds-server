const express = require('express');
const db = require('../models');
const axios = require('axios');
const querystring = require('querystring');
const moment = require('moment');
const router = express.Router();

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
				device_id: moment().unix(),
				redirect_uri: `${process.env.CLIENT_HOST}/integrate/hubrise`,
				client_id: `${process.env.HUBRISE_CLIENT_ID}`,
				scope: `${process.env.HUBRISE_SCOPES}`,
				country: 'UK',
				account_name: `${user.firstname} ${user.lastname}`,
				location_name: user.address.city,
			}
			const query_string = querystring.stringify(params).replace(/%20/g, '+');
			console.log('query params', query_string);
			const URL = "https://manager.hubrise.com/oauth2/v1/authorize" + '?' + query_string;
			// const URL = `https://manager.hubrise.com/oauth2/v1/authorize?redirect_uri=${process.env.CLIENT_HOST}/integrate/hubrise&client_id=${process.env.HUBRISE_CLIENT_ID}&scope=${process.env.HUBRISE_SCOPES}`;
			res.redirect(URL);
		} else {
			let error = new Error(`User with email ${email} could not be found`)
			error.status = 404
			throw error
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
		console.log("--------------------------")
		console.log("Account Credentials")
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
			"url": `${process.env.API_HOST}/hubrise`,
			"events": {
				"order": ["create", "update"]
			}
		}
		let config = {
			headers: {
				'X-Access-Token': result.access_token
			}
		};
		const webhook = process.env.NODE_ENV === 'production' ? (await axios.post(URL, payload, config)).data : null
		console.log("--------------------------")
		console.log("Hubrise Webhook")
		console.table(webhook);
		console.log("--------------------------")
		// set access_token to postman header
		res.status(200).json(user['hubrise']);
	} catch (err) {
		if (err.response) {
			console.log(err.response.data);
		} else {
			console.error('ERROR', err);
		}
		res.status(500).json({ message: err.message });
	}
});

router.patch('/disconnect', async(req, res, next) => {
	try {
		const { email } = req.body;
		const user = await db.User.findOneAndUpdate({ email: email }, {
			'hubrise.accessToken': undefined,
			'hubrise.accountName': undefined,
			'hubrise.locationName': undefined,
			'hubrise.locationId': undefined,
			'hubrise.catalogName': undefined,
			'hubrise.catalogId': undefined,
			'hubrise.customerListName': undefined,
			'hubrise.customerListId': undefined
		}, { new: true });
		if (user) {
			console.log(user['hubrise'])
			return res.status(200).json({ message: "Hubrise account has been disconnected" })
		} else {
			let error = new Error(`User with email ${email} could not be found`)
			error.status = 404
			throw error
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
