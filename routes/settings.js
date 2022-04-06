const express = require('express');
const db = require('../models');
const { BATCH_OPTIONS } = require('@seconds-technologies/database_schemas/constants');
const moment = require('moment');
const router = express.Router();
const schedule = require('node-schedule');
const { EventBridge } = require('../constants');

function generateCronExpression(deadline, deliveryHours) {
	//filter user's delivery hours by days that they can deliver on
	const hour = deadline.get("hour")
	const minute = deadline.get("minute")
	console.log('************************************************');
	const deliveryDays = Object.entries(deliveryHours).filter(([key, value]) => value.canDeliver).map(([key, value]) => Number(key)+1)
	console.log(deliveryDays)
	console.log('************************************************');
	const cron = `${minute} ${hour} ? * ${deliveryDays.join(",")} *`
	console.log(cron);
	return { cron, deliveryDays }
}

async function createDailyBatchScheduler(isEnabled=false, user, settings) {
	let h = Number(settings.autoBatch.daily.deadline.slice(0, 2));
	let m = Number(settings.autoBatch.daily.deadline.slice(3));
	console.table({h, m})
	// generate cron using UTC time
	const deadline = moment({ h, m }).utc();
	console.log(deadline)
	const { cron, deliveryDays } = generateCronExpression(deadline, user.deliveryHours);
	let regex = "^([\\p{L}\\p{Z}\\p{N}_.:/=+\\-@]*)$"
	// TODO - apply regex filtering to tag key and value properties
	const Tags = [
		{
			Key: "clientId",
			Value: user['_id']
		},
		{
			Key: "clientEmail",
			Value: user.email
		},
		{
			Key: "clientDeliveryDays",
			Value: deliveryDays.join("_")
		},
		{
			Key: "lastModifiedAt",
			Value: moment().format()
		}
	]
	const RuleName = `${process.env.ENVIRONMENT_MODE}.${user._id}`
	const ScheduleExpression = `cron(${cron})`
	console.log(ScheduleExpression)
	// create EventBridge Rule
	const rule = await EventBridge.putRule({
		Name: RuleName,
		Description: `Daily batch scheduler for ${user.firstname} ${user.lastname}`,
		ScheduleExpression,
		State: isEnabled ? "ENABLED" : "DISABLED"
	})
	console.log(rule)
	// apply the target as the SQS queue which will trigger the lambda function to carry out the route-optimization + route assignment
	const target = await EventBridge.putTargets({
		Rule: RuleName,
		Targets: [
			{
				Arn: process.env.AWS_SQS_ARN,
				Id: settings._id,
				Input: JSON.stringify({ id: user._id })
			}
		]
	});
	console.log(target)
	// apply useful tags to identify the scheduled task in AWS
	const tagResult = await EventBridge.tagResource({
		ResourceARN: rule.RuleArn,
		Tags
	})
	console.log(tagResult)
	return rule
}

function createIncrementalBatchScheduler(isEnabled=false, user, settings) {
	return true;
}

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
				createIncrementalBatchScheduler(req.body.autoBatch.enabled, user, settings);
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