const axios = require('axios');
const db = require('../models/index');
const { v4: uuidv4 } = require('uuid');

const getCredentials = async (req, res) => {
	try {
		console.log(req.body);
		res.status(200).json(req.body);
	} catch (err) {
		console.error(err);
		res.status(400).json({ message: err.message });
	}
};

const authorizeSquareAccount = async (req, res, next) => {
	try {
		const { clientId, clientSecret, code } = req.body;
		const baseURL = "https://connect.squareup.com"
		const scope = "ORDERS_READ+MERCHANT_PROFILE_READ+PAYMENTS_READ+SETTLEMENTS_READ+BANK_ACCOUNTS_READ+INVENTORY_READ+CUSTOMERS_READ"
		const state = uuidv4()
		const URL = `${baseURL}/oauth2/authorize?client_id=${clientId}&scope=${scope}&session=false&state=${state}`
		console.log(URL)
		/*const config = {
			headers: {
				"Square-Version": process.env.SQUARE_VERSION,
				"Content-Type": "application/json"
			},
			params: {
				clientId,
				scope,
				session: false,
				state
			}
		}
		const response = (await axios.post(URL, { clientId }, config)).data;
		console.log(response)
		//check if a user has an account integrated with this shopify account already
		const users = await db.User.find({"square.shopId": response['merchant_id']})*/
		res.redirect(303, URL)
	} catch (err) {
		console.error(err);
		res.status(400).json({message: err.message})
	}
};

module.exports = { authorizeSquareAccount, getCredentials };