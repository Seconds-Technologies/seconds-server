const db = require('../models/index');
const { v4: uuidv4 } = require('uuid');
const { Client, Environment } = require('square');

const client = new Client({
	environment: Environment.Production
});

const authorizeSquareAccount = async (req, res, next) => {
	try {
		const { clientId, clientSecret, email } = req.body;
		const baseURL = 'https://connect.squareup.com';
		const scope = process.env.SQUARE_SCOPES;
		const state = uuidv4();
		const URL = `${baseURL}/oauth2/authorize?client_id=${clientId}&scope=${scope}&session=false&state=${state}`;
		console.log(URL);
		const user = await db.User.findOneAndUpdate({ 'email': email }, {
			'square.clientId': clientId,
			'square.clientSecret': clientSecret,
			'square.state': state
		}, { new: true });
		console.log(user['square']);
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
		res.redirect(303, URL);
	} catch (err) {
		console.error(err);
		res.status(400).json({ message: err.message });
	}
};

const getCredentials = async (req, res) => {
	try {
		const { email, code, state } = req.query;
		// find the user authorizing their square account
		const user = await db.User.findOne({ 'email': email }, {});
		console.log("State Received:", state)
		console.log("State Stored:", state)
		if (state !== user['square'].state){
			throw new Error('Cannot verify the origin. Request authorization state does not match our records')
		}
		// grab the square client ID and secret used for the auth
		const { clientId, clientSecret } = user['square'];
		const payload = {
			clientId,
			clientSecret,
			code,
			grantType: 'authorization_code',
			shortLived: false
		};
		// use square client api to fetch the access token using credentials
		const { result } = await client.oAuthApi.obtainToken(payload);
		// configure new square api client with authenticated access token
		const newClient = client.withConfiguration({
			accessToken: result.accessToken
		});
		// use merchantId to grab the business information
		const {
			result: { merchant },
			...httpResponse
		} = await newClient.merchantsApi.retrieveMerchant(result.merchantId);
		console.log('MERCHANT INFO');
		console.table(merchant);
		// console.log(httpResponse)
		// grab the account's primary site domain
		const { result: { sites } } = await newClient.sitesApi.listSites();
		console.log('SITE INFO');
		sites.forEach(site => console.table(site));
		// store access token and related info to database
		user.updateOne({
			'square': {
				clientId,
				clientSecret,
				shopId: merchant.id,
				shopName: merchant.businessName,
				domain: sites[0].domain,
				accessToken: result.accessToken,
				expireTime: result.expiresAt
			}
		});
		await user.save();
		res.status(200).json({
			clientId,
			clientSecret,
			accessToken: result.accessToken,
			expireTime: result.expiresAt,
			shopId: result.merchantId,
			shopName: merchant.businessName,
			domain: sites[0].domain
		});
	} catch (err) {
		console.error(err);
		res.status(400).json({ message: err.message });
	}
};


module.exports = { authorizeSquareAccount, getCredentials };