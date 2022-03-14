const express = require('express');
const db = require('../models');
const router = express.Router();

router.patch('/business-workflow', async (req, res, next) => {
	try {
		const { email } = req.query;
		const user = await db.User.findOne({ email: email})
		if (user) {
			// use the clientId to search for their settings
			// if found update, if not exists create a new one
			let settings = await db.Settings.findOneAndUpdate({clientId: user['_id']}, req.body, {new: true})
			if (!settings) settings = await db.Settings.create({clientId: user['_id'], ...req.body})
			console.log(settings)
			res.status(200).json({message: "Settings updated successfully", ...settings.toObject()})
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

router.patch('/update-providers', async(req, res, next) => {
	try {
		const { email } = req.query;
		console.log(req.body)
		const user = await db.User.findOne({ email })
		if (user) {
			// use the clientId to search for their settings
			let settings = await db.Settings.findOneAndUpdate({clientId: user['_id']}, {activeFleetProviders: req.body }, {new: true})
			console.log(settings.activeFleetProviders)
			res.status(200).json({message: "Providers updated successfully", ...settings.toObject()['activeFleetProviders']})
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