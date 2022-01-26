const express = require('express');
const db = require('../models');
const axios = require('axios');
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
		const { clientId, clientSecret, email } = req.body;
		const user = await db.User.findOneAndUpdate(
			{ email },
			{
				'hubrise.clientId': clientId,
				'hubrise.clientSecret': clientSecret
			}
		);
		console.log(user['hubrise']);
		const URL = `https://manager.hubrise.com/oauth2/v1/authorize?redirect_uri=${process.env.CLIENT_HOST}/integrate/hubrise&client_id=${clientId}&scope=${process.env.HUBRISE_SCOPES}`;
		res.redirect(URL);
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
			client_id: user['hubrise'].clientId,
			client_secret: user['hubrise'].clientSecret
		};
		let result = (await axios.post(URL, null, { params })).data;
		console.log(result);
		// append access token + location_id to hubrise property of the user document
		user['hubrise'].accessToken = result.access_token;
		user['hubrise'].locationId = result.location_id;
		user['hubrise'].locationName = result.location_name;
		user['hubrise'].accountName = result.account_name;
		await user.save();
		// create webhook subscription
		URL = 'https://api.hubrise.com/v1/callback';
		const payload = {
			"url": `${process.env.API_HOST}/hubrise`,
			"events": {
				"order": ["create"]
			}
		}
		const config = {
			headers: {
				'X-Access-Token': result.access_token
			}
		};
		const webhook = (await axios.post(URL, payload, config)).data;
		console.log(webhook);
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

module.exports = router;
