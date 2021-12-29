const db = require('../models/index');
const { v4: uuidv4 } = require('uuid');
const querystring = require('querystring');
const axios = require('axios');

const authorizeWoocommerceAccount = async (req, res, next) => {
	try {
		/*setTimeout(() => {
			res.redirect(304, `${process.env.CLIENT_HOST}/integrate/woocommerce?success=0&error=Request timeout`);
		}, 5000)*/
		const { store_url, email } = req.body;
		const endpoint = '/wc-auth/v1/authorize';
		const params = {
			app_name: 'Seconds',
			scope: 'read',
			user_id: email,
			return_url: `${process.env.CLIENT_HOST}/integrate/woocommerce`,
			callback_url: `${process.env.SERVER_HOST}/server/woocommerce`
		}
		// trim off any trailing slashes
		let domain = store_url.endsWith('/') ? store_url.slice(0, -1) : store_url;
		// update the woocommerce domain within the db
		await db.User.findOneAndUpdate({ 'email': email }, { 'woocommerce.domain': domain });
		const query_string = querystring.stringify(params).replace(/%20/g, '+');
		console.log('query params', query_string);
		const URL = store_url + endpoint + '?' + query_string;
		console.log('URL:', URL);
		// redirect to the built auth woocommerce URL
		res.redirect(303, URL);
	} catch (err) {
		if (err.response) {
			console.log(err.response.data);
		} else {
			console.error('ERROR', err);
		}
		res.redirect(304, `${process.env.CLIENT_HOST}/integrate/woocommerce?success=0&error=${err.message}`);
	}
};

const getCredentials = async (req, res) => {
	try {
		const { user_id, key_id, consumer_key, consumer_secret } = req.body;
		const user = await db.User.findOneAndUpdate({ 'email': user_id }, {
			'woocommerce.consumerKey': consumer_key,
			'woocommerce.consumerSecret': consumer_secret
		}, { new: true });
		console.log(user.woocommerce);
		const URL = `${user['woocommerce'].domain}/wp-json/wc/v3/system_status`;
		/*const { environment } = (await axios.get(URL, {
			auth: {
				username: consumer_key,
				password: consumer_secret
			}
		})).data;*/
		res.status(200).json({
			success: true,
			...user.woocommerce
		});
	} catch (err) {
		console.error(err);
		res.status(500).json({ success: false, message: err.message });
	}
};

module.exports = { getCredentials, authorizeWoocommerceAccount };