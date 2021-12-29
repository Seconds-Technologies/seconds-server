const db = require('../models/index');
const { v4: uuidv4 } = require('uuid');
const querystring = require('querystring');
const axios = require('axios');

const authorizeWoocommerceAccount = async (req, res, next) => {
	try {
		const { store_url, email, callback_url } = req.body;
		const endpoint = '/wc-auth/v1/authorize';
		const params = {
			app_name: 'Seconds',
			scope: 'read',
			user_id: email,
			return_url: `${process.env.CLIENT_HOST}/integrate/woocommerce`,
			callback_url
		};
		const query_string = querystring.stringify(params).replace(/%20/g, '+');
		console.table({query_string})
		const URL = store_url + endpoint + '?' + query_string
		console.table({URL})
		const response = (await axios.get(URL)).data
		console.log(response)
		res.status(200).json({
			success: true,
			...response
		});
	} catch (err) {
		console.error(err);
		res.status(500).json({
			success: false,
			message: err.message
		});
	}
};

const getCredentials = async (req, res) => {
	try {
		console.log(req.body)
	    res.status(200).json(req.body)
	} catch (err) {
	    console.error(err)
		res.status(500).json({message: err.message});
	}
}

module.exports = { getCredentials, authorizeWoocommerceAccount };