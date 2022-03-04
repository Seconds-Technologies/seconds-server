const express = require('express');
const db = require('../models');
const router = express.Router();

router.patch('/business-workflow', async (req, res, next) => {
	try {
		const { email } = req.query;
		const user = await db.User.findOne({ email: email})
		if (user) {
			const settings = await db.Settings.create({clientId: user['_id'], ...req.body})
			console.log(settings)
			res.status(200).json({message: "Settings updated successfully", ...req.body})
		} else {
			return next({
				status: 404,
				message: "Could not find user with the email " + email
			})
		}
	} catch (err) {
	    console.error(err)
		return next({
			status: err.status ? err.status : 500,
			message: err.message
		})
	}
})

module.exports = router