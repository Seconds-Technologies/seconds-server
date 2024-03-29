const axios = require('axios');
const db = require('../models');
const querystring = require('querystring');
const { v4: uuidv4 } = require('uuid');

const getCredentials = async (req, res, next) => {
	try {
		let { email } = req.query
		let { squarespace } = await db.User.findOne({ email });
		console.log(squarespace)
		if (squarespace.accessToken || squarespace.refreshToken) {
			res.status(200).json({
				...squarespace,
			});
		} else {
			throw new Error("This user has no squarespace account integrated");
		}
	} catch (err) {
		console.error(err);
		return next({
			status: 404,
			message: "Unable to retrieve squarespace details",
		});
	}
}

const connect = async (req, res, next) => {
	try {
		const { email, code, state } = req.query;
		// find the user authorizing their squarespace account
		let user = await db.User.findOne({ 'email': email });
		// verify that the state from the response matches that stored for the user
		if (state !== user['squarespace'].state) {
			throw new Error('Cannot verify the origin. Request authorization state does not match our records');
		}
		// use code to request access token
		console.log("Decoded code:", decodeURI(code))
		let URL = "https://login.squarespace.com/api/1/login/oauth/provider/tokens"
		let payload = {
			grant_type: "authorization_code",
			code: decodeURI(code),
			redirect_uri: `${process.env.CLIENT_HOST}/integrate/squarespace`
		}
		const token = Buffer.from(`${process.env.SQUARESPACE_CLIENT_ID}:${process.env.SQUARESPACE_SECRET}`).toString('base64')
		console.log("Base64 token", token)
		let config = {
			headers: { 'Authorization': `Basic ${token}`}
		}
		// make request to fetch squarespace Oauth credentials
		const response = (await axios.post(URL, payload, config)).data
		console.log(response)
		// make request to create webhook subscription for the squarespace store
		URL = "https://api.squarespace.com/1.0/webhook_subscriptions"
		payload = {
			endpointUrl: `${process.env.API_HOST}/api/v1/squarespace`,
			topics: ["order.create"]
		}
		config = {
			headers: {
				'Authorization': `Bearer ${response.access_token}`
			}
		}
		const webhook = (await axios.post(URL, payload, config)).data
		console.log(webhook)
		// store accessToken to squarespace field in user document
		user = await db.User.findOneAndUpdate({"email": email}, {
			'squarespace.accessToken' : response.access_token,
			'squarespace.refreshToken' : response.refresh_token,
			'squarespace.accessTokenExpireTime' : response['access_token_expires_at'],
			'squarespace.refreshTokenExpireTime' : response['refresh_token_expires_at'],
		}, {new: true})
		/*user['squarespace'].accessToken = response.access_token
		user['squarespace'].accessTokenExpireTime = response['access_token_expires_at']
		user['squarespace'].refreshToken = response.refresh_token
		user['squarespace'].refreshTokenExpireTime = response['refresh_token_expires_at']
		await user.save()
		*/
		res.status(200).json(user['squarespace']);
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: err.message });
	}
};

const authorize = async (req, res) => {
	try {
		const { email, privateKey } = req.body;
		let state = uuidv4();
		let URL = 'https://api.squarespace.com/1.0/authorization/website';
		const result = (await axios.get(URL, {
			headers: {
				'Authorization': 'Bearer ' + privateKey
			}
		})).data;
		console.log(result);
		// check if the squarespace store is not connected to an existing user
		const numUsers = await db.User.countDocuments({'squarespace.siteId': result.id})
		if (numUsers > 0) throw new Error('There is already a user connected to this site')
		// attach the initial squarespace credentials
		await db.User.findOneAndUpdate({ 'email': email }, {
			'squarespace': {
				secretKey: privateKey,
				siteId: result.id,
				storeName: result.title,
				domain: result.url,
				state
			}
		}, { new: true });
		// create object query params
		const params = {
			client_id: process.env.SQUARESPACE_CLIENT_ID,
			redirect_uri: `${process.env.CLIENT_HOST}/integrate/squarespace`,
			scope: 'website.orders,website.orders.read',
			state,
			access_type: 'offline'
		};
		const baseURL = 'https://login.squarespace.com/api/1/login/oauth/provider/authorize';
		const query_string = querystring.stringify(params).replace(/%20/g, '+');
		console.log('query params', query_string);
		URL = baseURL + '?' + query_string;
		console.log('URL:', URL);
		res.redirect(303, URL);
	} catch (err) {
		console.error(err);
		const URL = `${process.env.CLIENT_HOST}/integrate/squarespace?error=${err.message}`
		res.redirect(303, URL)
	}
};

module.exports = { getCredentials, connect, authorize };