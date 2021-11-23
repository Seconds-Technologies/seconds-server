const { S3 } = require('../constants/index');
const db = require('../models');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

function encode(data) {
	let buf = Buffer.from(data);
	return buf.toString('base64');
}

async function getBase64Image(filename) {
	if (filename) {
		const data = await S3.getObject({
			Bucket: 'seconds-profile-pictures',
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

async function handleActiveSubscription(subscription) {
	try {
		console.log(subscription.items.data);
		const SUBSCRIPTION_PLANS = process.env.STRIPE_SUBSCRIPTION_PLANS.split(' ');
		const COMMISSION_PLANS = process.env.STRIPE_COMMISSION_PLANS.split(' ');
		const { id, customer, status, items: { data } } = subscription;
		if (status === 'active') {
			let user = null;
			if (SUBSCRIPTION_PLANS.includes(data[0].price.lookup_key)) {
				user = await db.User.findOneAndUpdate(
					{ stripeCustomerId: customer },
					{ subscriptionId: id, subscriptionPlan: data[0].price.lookup_key },
					{ new: true }
				);
				const prices = await stripe.prices.list({
					lookup_keys: [`${data[0].price.lookup_key}-commission`],
					expand: ['data.product']
				});
				await stripe.subscriptions.create({
					customer: user.stripeCustomerId,
					default_payment_method: user.paymentMethodId,
					items: [
						{ price: prices.data[0].id }
					]
				});
			} else if (COMMISSION_PLANS.includes(data[0].price.lookup_key)) {
				user = await db.User.findOneAndUpdate(
					{ stripeCustomerId: customer },
					{ stripeCommissionId: id },
					{ new: true }
				);
			} else {
				throw new Error(`Unrecognized subscription item with look-up key ${data[0].price.lookup_key}`);
			}
			if (user) {
				console.log('------------------------------------');
				console.log('updated user:', user);
				console.log('------------------------------------');
				return 'Subscription is active';
			} else {
				throw new Error('No user found with a matching stripe customer ID!');
			}
		} else {
			throw new Error('Subscription status is not active');
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
		const COMMISSION_PLANS = process.env.STRIPE_COMMISSION_PLANS.split(' ');
		const { customer, status, items: { data } } = subscription;
		if (status === 'canceled') {
			let user = null;
			if (SUBSCRIPTION_PLANS.includes(data[0].price.lookup_key)) {
				user = await db.User.findOneAndUpdate(
					{ stripeCustomerId: customer },
					{ subscriptionId: '', subscriptionPlan: '', stripeCommissionId: '' },
					{ new: true }
				);
				await stripe.subscriptions.del(user.stripeCommissionId, {
					invoice_now: true
				});
			} else if (COMMISSION_PLANS.includes(data[0].price.lookup_key)) {
				user = await db.User.findOneAndUpdate(
					{ stripeCustomerId: customer },
					{ stripeCommissionId: '' },
					{ new: true }
				);
			}
			console.log('------------------------------------');
			console.log('updated user:', user);
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

module.exports = {
	getBase64Image,
	updateOrders,
	filterAndRemove,
	filterAndUpdateProducts,
	handleActiveSubscription,
	handleCanceledSubscription
};