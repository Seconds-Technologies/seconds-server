const { S3 } = require('../constants/index');
const db = require('../models');
const crypto = require('crypto');
const multer = require('multer');
const multerS3 = require('multer-s3');
const shorthash = require('shorthash');
const moment = require('moment');
const { VEHICLE_CODES, HUBRISE_STATUS, STATUS } = require('@seconds-technologies/database_schemas/constants');

function genApiKey() {
	let apiKey = '';
	const rand = crypto.randomBytes(24);
	let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.repeat(2);

	for (let i = 0; i < rand.length; i++) {
		let index = rand[i] % chars.length;
		apiKey += chars[index];
	}
	console.log('Generated API Key:', apiKey);
	return apiKey
}

function encode(data) {
	let buf = Buffer.from(data);
	return buf.toString('base64');
}

function checkGeolocationProximity(depot, pickup){
	/*console.log("Longitude")
	console.log('-----------------------------------------------');
	console.log(Number(depot[0]).toFixed(2))
	console.log(Number(pickup[0]).toFixed(2))*/
	let lngMatch = Number(depot[0]).toFixed(2) === Number(pickup[0]).toFixed(2)
	/*console.log("Latitude")
	console.log('-----------------------------------------------');
	console.log(Number(depot[1]).toPrecision(3))
	console.log(Number(pickup[1]).toPrecision(3))*/
	let latMatch = Number(depot[1]).toPrecision(3) === Number(pickup[1]).toPrecision(3)
	return lngMatch && latMatch
}

function countVehicles(drivers){
	const counts = [0,0,0,0,0]
	VEHICLE_CODES.forEach((code, codeIndex) => {
		drivers.forEach(({vehicle}) => {
			if (code === vehicle)
				counts[codeIndex] += 1
		})
	})
	return counts
}

function convertToHubriseStatus(status){
	switch (status){
		case STATUS.NEW:
			return HUBRISE_STATUS.NEW
		case STATUS.PENDING:
			return HUBRISE_STATUS.RECEIVED
		case STATUS.DISPATCHING:
			return HUBRISE_STATUS.IN_PREPARATION
		case STATUS.EN_ROUTE:
			return HUBRISE_STATUS.IN_DELIVERY
		case STATUS.COMPLETED:
			return HUBRISE_STATUS.COMPLETED
		case STATUS.CANCELLED:
			return HUBRISE_STATUS.CANCELLED
		default:
			return HUBRISE_STATUS.DELIVERY_FAILED
	}
}

async function getBase64Image(filename, bucketName) {
	if (filename) {
		const data = await S3.getObject({
			Bucket: bucketName,
			Key: filename
		}).promise();
		console.log(data);
		return encode(data.Body);
	}
	return '';
}

function updateOrders(orders, id, status) {
	let index = orders.findIndex(o => o.id === id);
	let order = orders[index];
	let newOrder = { ...order, status };
	orders.splice(index, 1, newOrder);
	return orders;
}

function filterAndUpdateProducts(products, id, keys) {
	console.log(Object.keys(keys));
	//filter product by id
	let index = products.findIndex(p => p.id === id);
	let product = products[index];
	if ('status' in keys) {
		product = updateStatus(product, keys['status']);
	}
	if ('quantity' in keys) {
		product = updateStock(product, keys['quantity']);
	}
	products.splice(index, 1, product);
	return products;
}

function filterAndRemove(products, id) {
	let index = products.findIndex(p => p.id === id);
	products.splice(index, 1);
	return products;
}

function updateStatus(product, status) {
	return { ...product, status: status };
}

function updateStock(product, quantity) {
	console.log(quantity);
	product['variants'][0]['inventory_quantity'] = quantity;
	return product;
}

function getSubscriptionItems(data) {
	let standardMonthly = data.find(({ id, price }) => {
		const whitelist = process.env.STRIPE_STANDARD_MONTHLY_IDS.split(' ')
		return whitelist.includes(price.id)
	})
	let standardCommission;
	// use the standardMonthly price lookup_key, to search for the correct standard commission subscription item
	if (standardMonthly) {
		let lookupKey = standardMonthly.price.lookup_key
		standardCommission = data.find(({ id, price }) => {
			const whitelist = process.env.STRIPE_STANDARD_COMMISSION_IDS.split(' ')
			return whitelist.includes(price.id) && price.lookup_key === lookupKey.concat("-commission")
		})
	} else {
		standardCommission = data.find(({ id, price }) => {
			const whitelist = process.env.STRIPE_STANDARD_COMMISSION_IDS.split(' ')
			return whitelist.includes(price.id)
		})
	}
	let multiDropCommission = data.find(({price}) => {
		const whitelist = process.env.STRIPE_MULTIDROP_COMMISSION_PRICES.split(' ')
		return whitelist.includes(price.id)
	})
	let smsCommission = data.find(({price}) => {
		const whitelist = process.env.STRIPE_SMS_COMMISSION_PRICES.split(' ')
		return whitelist.includes(price.id)
	})
	return { standardMonthly, standardCommission, multiDropCommission, smsCommission }
}

async function handleActiveSubscription(subscription) {
	try {
		console.log(subscription.items.data);
		const SUBSCRIPTION_PLANS = process.env.STRIPE_SUBSCRIPTION_PLANS.split(' ');
		console.log(SUBSCRIPTION_PLANS)
		const { id, customer, status, items: { data } } = subscription;
		if (status === 'active' || status === 'trialing') {
			const { standardMonthly, standardCommission, multiDropCommission, smsCommission } = getSubscriptionItems(data)
			const user = await db.User.findOneAndUpdate(
				{ stripeCustomerId: customer },
				{
					subscriptionId: id,
					subscriptionPlan: standardMonthly ? standardMonthly.price.lookup_key : "",
					'subscriptionItems.standardMonthly': standardMonthly ? standardMonthly.id : "",
					'subscriptionItems.standardCommission': standardCommission ? standardCommission.id : "",
					'subscriptionItems.multiDropCommission': multiDropCommission ? multiDropCommission.id : "",
					'subscriptionItems.smsCommission': smsCommission ? smsCommission.id : "",
				},
				{ new: true }
			);
			if (user) {
				console.log('------------------------------------');
				console.log('updated user:', user['subscriptionId'], user['subscriptionItems']);
				console.log('------------------------------------');
				return 'Subscription is active';
			} else {
				throw new Error('No user found with a matching stripe customer ID!');
			}
		} else {
			throw new Error(`Status for subscription with lookup key: ${data[0].price.lookup_key}, is not active`);
		}
	} catch (err) {
		console.error(err);
		throw err;
	}
}

async function handleCanceledSubscription(subscription) {
	try {
		console.log(subscription.items.data);
		const SUBSCRIPTION_PLANS = process.env.STRIPE_SUBSCRIPTION_PLANS.split(' ');
		const { customer, status, items: { data } } = subscription;
		if (status === 'canceled' && SUBSCRIPTION_PLANS.includes(data[0].price.lookup_key)) {
			const user = await db.User.findOneAndUpdate(
				{ stripeCustomerId: customer },
				{
					subscriptionId: '', subscriptionPlan: '',
					'subscriptionItems.standardMonthly': '',
					'subscriptionItems.standardCommission': '',
					'subscriptionItems.multiDropCommission': '',
					'subscriptionItems.smsCommission': ''
				},
				{ new: true }
			);
			console.log('------------------------------------');
			console.log('New subscription details');
			console.table({id: user.subscriptionId, plan: user.subscriptionPlan})
			console.log('------------------------------------');
			return 'Subscription is canceled';
		} else {
			throw new Error('Subscription status is not canceled');
		}
	} catch (err) {
		console.error(err);
		throw new Error('No user found with a matching stripe customer ID!');
	}
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

const uploadImage = bucket => multer({
	storage: multerS3({
		s3: S3,
		bucket,
		contentType: multerS3.AUTO_CONTENT_TYPE,
		metadata: function (req, file, cb) {
			cb(null, { fieldName: file.fieldname });
		},
		key: function (req, file, cb) {
			cb(null, `public/${shorthash.unique(file.originalname)}.jpg`);
		}
	})
});

const uploadDocument = bucket => multer({
		storage: multerS3({
			s3: S3,
			bucket,
			contentType: multerS3.AUTO_CONTENT_TYPE,
			metadata: function (req, file, cb) {
				cb(null, { fieldName: file.fieldname });
			},
			key: function (req, file, cb) {
				cb(null, `${process.env.ENVIRONMENT_MODE}/${moment().format("DD-MM-YYYY")}/${req.body.orderNumber}/${shorthash.unique(file.originalname)}.jpg`);
			}
		})
	});

module.exports = {
	uploadImage,
	uploadDocument,
	genApiKey,
	getBase64Image,
	updateOrders,
	filterAndRemove,
	filterAndUpdateProducts,
	handleActiveSubscription,
	handleCanceledSubscription,
	checkGeolocationProximity,
	countVehicles,
	convertToHubriseStatus,
	delay,
};