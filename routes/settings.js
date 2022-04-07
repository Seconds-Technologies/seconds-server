const express = require('express');
const db = require('../models');
const { BATCH_OPTIONS } = require('@seconds-technologies/database_schemas/constants');
const moment = require('moment');
const router = express.Router();
const schedule = require('node-schedule');
const { EventBridge } = require('../constants');
const { createDailyBatchScheduler, createIncrementalBatchScheduler } = require('../helpers/settings');

router.patch('/business-workflow', async (req, res, next) => {
	try {
		const { email } = req.query;
		const user = await db.User.findOne({ email: email });
		if (user) {
			// use the clientId to search for their current settings
			let prevSettings = await db.Settings.findOne({ clientId: user['_id'] });
			// apply new changes to their settings
			let settings = await db.Settings.findOneAndUpdate({ clientId: user['_id'] }, req.body, { new: true });
			// if no previous settings were found, create new settings for the user
			if (!prevSettings) settings = await db.Settings.create({ clientId: user['_id'], ...req.body });
			console.log('-----------------------------------------------');
			// if register the [ DAILY | INCREMENTAL ] batching scheduler using the specified time configurations
			// define cases for creating the daily batch scheduler
			const caseDaily = req.body.defaultBatchMode === BATCH_OPTIONS.DAILY
			const caseHourly = req.body.defaultBatchMode === BATCH_OPTIONS.INCREMENTAL
			//if either of the cases are true, create the daily batch scheduler
			if (caseDaily) {
				await createDailyBatchScheduler(req.body.autoBatch.enabled, user.toObject(), settings.toObject());
			} else if (caseHourly) {
				await createIncrementalBatchScheduler(req.body.autoBatch.enabled, user.toObject(), settings.toObject());
			}
			res.status(200).json({ message: 'Settings updated successfully', ...settings.toObject() });
		} else {
			return next({
				status: 404,
				message: 'Could not find user with the email ' + email
			});
		}
	} catch (err) {
		console.error(err);
		return next({
			status: err.status ? err.status : 500,
			message: err.message
		});
	}
});

router.patch('/update-providers', async (req, res, next) => {
	try {
		const { email } = req.query;
		console.log(req.body);
		const user = await db.User.findOne({ email });
		if (user) {
			// use the clientId to search for their settings
			let settings = await db.Settings.findOneAndUpdate({ clientId: user['_id'] }, { activeFleetProviders: req.body }, { new: true });
			console.log(settings.activeFleetProviders);
			res.status(200).json({ message: 'Providers updated successfully', ...settings.toObject()['activeFleetProviders'] });
		} else {
			return next({
				status: 404,
				message: 'Could not find user with the email ' + email
			});
		}
	} catch (err) {
		console.error(err);
		return next({
			status: err.status ? err.status : 500,
			message: err.message
		});
	}
});

module.exports = router;