const axios = require('axios');
const db = require('../models');
const querystring = require('querystring');
const { v4: uuidv4 } = require('uuid');

const connect = async (req, res, next) => {
	try {
		const { email, code, state } = req.query;
		// find the user authorizing their squarespace account
		let user = await db.User.findOne({ 'email': email });
		console.log('State Received:', state);
		console.log('State Stored:', user['squarespace'].state);
		// verify that the state from the response matches that stored for the user
		if (state !== user['squarespace'].state) {
			throw new Error('Cannot verify the origin. Request authorization state does not match our records');
		}
		// use code to request an access token
		console.log("Decoded code:", decodeURI(code))
		const URL = "https://login.squarespace.com/api/1/login/oauth/provider/tokens"
		const payload = {
			grant_type: "authorization_code",
			code: decodeURI(code),
			redirect_uri: `${process.env.CLIENT_HOST}/integrate/squarespace`
		}
		const token = Buffer.from(`${process.env.SQUARESPACE_CLIENT_ID}:${process.env.SQUARESPACE_SECRET}`).toString('base64')
		console.log("Base64 token", token)
		const config = {
			headers: { 'Authorization': `Basic ${token}`}
		}
		const response = (await axios.post(URL, payload, config)).data
		console.log(response)
		// store accessToken to squarespace field in user document
		user = await db.User.findOneAndUpdate({"email": email}, {
			'squarespace.accessToken' : response.access_token,
			'squarespace.accessTokenExpireTime' : response['access_token_expires_at'],
			'squarespace.refreshToken' : response.refresh_token,
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
		// attach the initial squarespace credentials
		const user = await db.User.findOneAndUpdate({ 'email': email }, {
			'squarespace': {
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
	}
};

module.exports = { connect, authorize };