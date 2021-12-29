const db = require('../models/index');
const { v4: uuidv4 } = require('uuid');
const querystring = require('querystring');
const axios = require('axios');

const authorizeWoocommerceAccount = async (req, res, next) => {
	try {
		const { store_url, email } = req.body;
		const endpoint = '/wc-auth/v1/authorize';
		const params = {
			app_name: 'Seconds',
			scope: 'read',
			user_id: email,
			return_url: `${process.env.CLIENT_HOST}/integrate/woocommerce`,
			callback_url: `${process.env.SERVER_HOST}/server/woocommerce`
		};
		const query_string = querystring.stringify(params).replace(/%20/g, '+');
		console.table({query_string})
		const URL = store_url + endpoint + '?' + query_string
		console.table({URL})
		const response = (await axios.get(URL)).data
		console.log(response)
		res.redirect(303, URL);
	} catch (err) {
		console.error("ERROR", err);
		res.redirect(303, `${process.env.CLIENT_HOST}/integrate/woocommerce?success=0&error=${err.message}`);
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