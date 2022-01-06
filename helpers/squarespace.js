const axios = require('axios');
const db = require('../models');
const querystring = require('querystring');
const { v4: uuidv4 } = require('uuid');

const connect = async (req, res, next) => {
	try {
		const { email } = req.query;
		const { privateKey } = req.body;
		const URL = 'https://api.squarespace.com/1.0/authorization/website';
		const result = (await axios.get(URL, {
			headers: {
				'Authorization': 'Bearer ' + privateKey
			}
		})).data;
		console.log(result);
		// save information in the db
		const squarespace = {
			siteId: result.siteId,
			domain: result.url,
			secretKey: privateKey,
			storeName: result.title
		};
		const user = await db.User.findOneAndUpdate({ 'email': email }, { 'squarespace': squarespace }, { new: true });
		console.log(user.squarespace);
		res.status(200).json(user.squarespace);
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: err.message });
	}
};

const authorize = async (req, res) => {
	try {
		const { email } = req.query;
		const { privateKey } = req.body;
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
				siteId: result.siteId,
				domain: result.url,
				state
			}
		}, { new: true });
		// create object query params
		const params = {
			client_id: process.env.SQUARESPACE_CLIENT_ID,
			redirect_uri: `${process.env.CLIENT_HOST}/integrate/squarespace`,
			scope: 'website.orders, website.orders.read',
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