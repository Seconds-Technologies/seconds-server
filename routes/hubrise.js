const express = require('express');
const db = require('../models');
const router = express.Router();

router.post('/authorize', async (req, res) => {
	try {
		const { clientId, clientSecret, email } = req.body;
		const user = await db.User.findOneAndUpdate({ email}, {'hubrise.clientId': clientId, 'hubrise.clientSecret': clientSecret})
		console.log(user['hubrise'])
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

router.post('/callback', async (req, res) => {
	try {
		res.status(200).json({success: true})
	} catch (err) {
		console.error(err);
		res.status(500).json({message: err.message});
	}
});

module.exports = router;