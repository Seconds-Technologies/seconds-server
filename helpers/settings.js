const moment = require('moment');
const { EventBridge } = require('../constants');
const { BATCH_OPTIONS } = require('@seconds-technologies/database_schemas/constants');

function getMaxHourlyRange(deliveryHours) {
	let earliestOpen = moment(deliveryHours[0].open);
	let latestClose = moment(deliveryHours[0].close);
	Object.entries(deliveryHours).forEach(([day, value]) => {
		if (moment(value.open).isBefore(earliestOpen)) {
			earliestOpen = moment(value.open);
		}
		if (moment(value.close).isAfter(latestClose)) {
			latestClose = moment(value.close);
		}
	});
	return { earliestOpenHour: earliestOpen.get('hour'), latestCloseHour: latestClose.get('hour') };
}

function checkPickupHours(pickupTime, deliveryHours) {
	console.log('===================================================================');
	const deliveryDay = String(moment(pickupTime).day());
	console.log('Current Day:', deliveryDay);
	// get open / close times for the current day of the week
	const open = moment({
		y: moment(pickupTime).get('year'),
		M: moment(pickupTime).get('month'),
		d: moment(pickupTime).get('date'),
		h: deliveryHours[deliveryDay].open['h'],
		m: deliveryHours[deliveryDay].open['m']
	});
	const close = moment({
		y: moment(pickupTime).get('year'),
		M: moment(pickupTime).get('month'),
		d: moment(pickupTime).get('date'),
		h: deliveryHours[deliveryDay].close['h'],
		m: deliveryHours[deliveryDay].close['m']
	});
	const canDeliver = deliveryHours[deliveryDay].canDeliver;
	// check time of creation is within the delivery hours
	let timeFromOpen = moment.duration(moment(pickupTime).diff(open)).asHours();
	let timeFromClose = moment.duration(moment(pickupTime).diff(close)).asHours();
	console.log('DURATION:', { open: open.format('HH:mm'), timeFromOpen });
	console.log('DURATION:', { close: close.format('HH:mm'), timeFromClose });
	console.log('===================================================================');
	const isValid = canDeliver && timeFromOpen >= 0 && timeFromClose <= -0.5;
	console.log('Is pickup time valid:', isValid);
	return isValid;
}

function setNextDayDeliveryTime(pickupTime, deliveryHours) {
	console.log('===================================================================');
	const max = 6;
	let interval = 0;
	let nextDay = moment(pickupTime).day();
	console.log('Current Day:', nextDay);
	// check that the store has at least one day in the week that allows delivery
	const isValid = Object.entries(JSON.parse(JSON.stringify(deliveryHours))).some(
		([_, value]) => value.canDeliver === true
	);
	// check if the datetime is not in the past & if store allows delivery on that day, if not check another day
	if (isValid) {
		// if a day does not allow deliveries OR the day does allow delivery BUT the order's PICKUP time is PAST of the current day's OPENING time (only when nextDay = "deliveryDay")
		// iterate over to the next day
		// OTHERWISE set the pickup time = store open hour for current day, dropoff time = store closing hour for current day
		console.log('CAN DELIVER:', deliveryHours[nextDay].canDeliver);
		while (
			!deliveryHours[nextDay].canDeliver ||
			moment(pickupTime).isBefore(
				moment({
					y: moment(pickupTime).get('year'),
					M: moment(pickupTime).get('month'),
					d: moment(pickupTime).get('date'),
					h: deliveryHours[nextDay].open['h'],
					m: deliveryHours[nextDay].open['m']
				}).add(interval, 'days'),
				'minutes'
			)
		) {
			nextDay === max ? (nextDay = 0) : (nextDay = nextDay + 1);
			console.log('Next Day:', nextDay);
			console.log('CAN DELIVER:', deliveryHours[nextDay].canDeliver);
			interval = interval + 1;
		}
		// return the pickup time for the next day delivery
		const open = {
			y: moment(pickupTime).get('year'),
			M: moment(pickupTime).get('month'),
			d: moment(pickupTime).get('date'),
			h: deliveryHours[nextDay].open['h'],
			m: deliveryHours[nextDay].open['m']
		};
		const close = {
			y: moment(pickupTime).get('year'),
			M: moment(pickupTime).get('month'),
			d: moment(pickupTime).get('date'),
			h: deliveryHours[nextDay].close['h'],
			m: deliveryHours[nextDay].close['m']
		};
		console.log('===================================================================');
		return moment(open).add(interval, 'days');
	} else {
		throw new Error('Store has no delivery hours available!');
	}
}

function generateDailyBatchCron(deadline, deliveryHours) {
	//filter user's delivery hours by days that they can deliver on
	const hour = deadline.get('hour');
	const minute = deadline.get('minute');
	console.log('************************************************');
	const deliveryDays = Object.entries(deliveryHours)
		.filter(([key, value]) => value.canDeliver)
		.map(([key, value]) => Number(key) + 1);
	console.log('************************************************');
	const cron = `${minute} ${hour} ? * ${deliveryDays.join(',')} *`;
	return { cron, deliveryDays };
}

async function createDailyBatchScheduler(isEnabled = false, user, settings) {
	let h = Number(settings.autoBatch.daily.deadline.slice(0, 2));
	let m = Number(settings.autoBatch.daily.deadline.slice(3));
	console.table({ h, m });
	// generate cron using UTC time
	const deadline = moment({ h, m }).utc();
	console.log(deadline);
	const { cron, deliveryDays } = generateDailyBatchCron(deadline, user.deliveryHours);
	let regex = '^([\\p{L}\\p{Z}\\p{N}_.:/=+\\-@]*)$';
	// TODO - apply regex filtering to tag key and value properties
	const Tags = [
		{
			Key: 'clientId',
			Value: user['_id']
		},
		{
			Key: 'clientEmail',
			Value: user.email
		},
		{
			Key: 'clientDeliveryDays',
			Value: deliveryDays.join('_')
		},
		{
			Key: 'lastModifiedAt',
			Value: moment().format()
		}
	];
	const dailyBatchRuleName = `${process.env.ENVIRONMENT_MODE}.daily.${user._id}`;
	const hourlyBatchRuleName = `${process.env.ENVIRONMENT_MODE}.hourly.${user._id}`;
	const ScheduleExpression = `cron(${cron})`;
	console.log(ScheduleExpression);
	// create EventBridge Rule for daily batch
	const dailyRule = await EventBridge.putRule({
		Name: dailyBatchRuleName,
		Description: `[${String(process.env.ENVIRONMENT_MODE).toUpperCase()}] Daily batch scheduler for ${
			user.firstname
		} ${user.lastname}`,
		ScheduleExpression,
		State: isEnabled ? 'ENABLED' : 'DISABLED'
	});
	// apply the target as the SQS queue which will trigger the lambda function to carry out the route-optimization + route assignment
	const target = await EventBridge.putTargets({
		Rule: dailyBatchRuleName,
		Targets: [
			{
				Arn: process.env.AWS_SQS_ARN,
				Id: settings._id,
				Input: JSON.stringify({ id: user._id, type: BATCH_OPTIONS.DAILY })
			}
		]
	});
	console.log(target);
	// apply useful tags to identify the scheduled task in AWS
	await EventBridge.tagResource({
		ResourceARN: dailyRule.RuleArn,
		Tags
	});
	// disable EventBridge Rule for HOURLY batching
	const hourlyRule = await EventBridge.putRule({
		Name: hourlyBatchRuleName,
		ScheduleExpression,
		Description: `[${String(process.env.ENVIRONMENT_MODE).toUpperCase()}] Hourly batch scheduler for ${
			user.firstname
		} ${user.lastname}`,
		State: "DISABLED"
	});
	console.table({ dailyRule, hourlyRule });
	return dailyRule;
}

function calculateNextHourlyBatch(deliveryHours, batchInterval) {
	const openTime = moment(deliveryHours[moment().day()].open);
	let canDeliver = deliveryHours[moment().day()].canDeliver;
	let nextBatchTime = openTime.clone();
	// loop over every <INTERVAL> hours from the store open time for current day
	// stop when the batch time is after the current time AND store can deliver on the batch day
	let offset = 1
	while (nextBatchTime.isBefore(moment()) || !canDeliver) {
		console.table({ NEXT_BATCH_TIME: nextBatchTime.format() });
		// if calculated next batch time is in the PAST, add <INTERVAL> hours
		nextBatchTime.add(batchInterval, 'hours');
		// check if the new batch time is within the store's delivery hours
		canDeliver = checkPickupHours(nextBatchTime.format(), deliveryHours);
		if (!canDeliver) {
			nextBatchTime = moment(deliveryHours[moment().day()].open).add(offset, "day")
		}
	}
	return nextBatchTime;
}

function generateHourlyBatchCron(batchTime, batchInterval, deliveryHours) {
	//filter user's delivery hours by days that they can deliver on
	const deliveryDays = Object.entries(deliveryHours)
		.filter(([key, value]) => value.canDeliver)
		.map(([key, value]) => Number(key) + 1);
	console.log('************************************************');
	const minute = batchTime.get('minute');
	const { earliestOpenHour, latestCloseHour } = getMaxHourlyRange(deliveryHours);
	const cron = `${minute} ${earliestOpenHour}-${latestCloseHour}/${batchInterval} ? * ${deliveryDays.join(',')} *`;
	return { cron, deliveryDays };
}

async function createIncrementalBatchScheduler(isEnabled = false, user, settings) {
	const nextBatchTime = calculateNextHourlyBatch(user.deliveryHours, settings.autoBatch.incremental.batchInterval);
	let h = nextBatchTime.get('hour');
	let m = nextBatchTime.get('minute');
	console.table({ h, m });
	const { cron, deliveryDays } = generateHourlyBatchCron(
		nextBatchTime,
		settings.autoBatch.incremental.batchInterval,
		user.deliveryHours
	);
	const Tags = [
		{
			Key: 'clientId',
			Value: user['_id']
		},
		{
			Key: 'clientEmail',
			Value: user.email
		},
		{
			Key: 'clientDeliveryDays',
			Value: deliveryDays.join('_')
		},
		{
			Key: 'lastModifiedAt',
			Value: moment().format()
		},
		{
			Key: 'type',
			Value: 'hourly'
		}
	];
	const hourlyBatchRuleName = `${process.env.ENVIRONMENT_MODE}.hourly.${user._id}`;
	const dailyBatchRuleName = `${process.env.ENVIRONMENT_MODE}.daily.${user._id}`;
	const ScheduleExpression = `cron(${cron})`;
	console.log(ScheduleExpression);
	// create EventBridge Rule
	const hourlyRule = await EventBridge.putRule({
		Name: hourlyBatchRuleName,
		Description: `[${String(process.env.ENVIRONMENT_MODE).toUpperCase()}] Hourly batch scheduler for ${
			user.firstname
		} ${user.lastname}`,
		ScheduleExpression,
		State: isEnabled ? 'ENABLED' : 'DISABLED'
	});
	// apply the target as the SQS queue which will trigger the lambda function to carry out the route-optimization + route assignment
	const target = await EventBridge.putTargets({
			Rule: hourlyBatchRuleName,
		Targets: [
			{
				Arn: process.env.AWS_SQS_ARN,
				Id: settings._id,
				Input: JSON.stringify({ id: user._id, type: BATCH_OPTIONS.INCREMENTAL })
			}
		]
	});
	console.log(target);
	// apply useful tags to identify the scheduled task in AWS
	await EventBridge.tagResource({
		ResourceARN: hourlyRule.RuleArn,
		Tags
	});
	// disable EventBridge Rule for DAILY batching
	const dailyRule = await EventBridge.putRule({
		Name: dailyBatchRuleName,
		ScheduleExpression,
		Description: `[${String(process.env.ENVIRONMENT_MODE).toUpperCase()}] Daily batch scheduler for ${
			user.firstname
		} ${user.lastname}`,
		State: "DISABLED"
	});
	console.table({hourlyRule, dailyRule})
	return hourlyRule;
}

module.exports = { createDailyBatchScheduler, createIncrementalBatchScheduler };
