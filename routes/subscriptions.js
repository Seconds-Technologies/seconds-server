require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../models');
const moment = require('moment');
const sendEmail = require('../services/email');
const router = express.Router();

function orderPriceIds(prices) {
	let products = [];
	let items = [];
	// add the core subscription plan price first
	const planPrice = prices.find(price => process.env.STRIPE_SUBSCRIPTION_PLANS.includes(price.lookup_key));
	items.push({ price: planPrice.id });
	products.push(planPrice.product.id);
	console.log(planPrice);
	// use the planPrice to add the standard commission fee price
	const commissionLookupKey = planPrice.lookup_key.concat('-commission');
	const commissionPrice = prices.find(price => price.lookup_key === commissionLookupKey);
	items.push({ price: commissionPrice.id });
	products.push(commissionPrice.product.id);
	// add multi-drop commission
	const multiDropPrice = prices.find(price => price.id === process.env.STRIPE_MULTIDROP_COMMISSION_PRICE);
	items.push({ price: multiDropPrice.id });
	products.push(multiDropPrice.product.id);
	const smsPrice = prices.find(price => price.id === process.env.STRIPE_SMS_COMMISSION_PRICE);
	items.push({ price: smsPrice.id });
	products.push(smsPrice.product.id);
	return { items, products };
}

function deleteSubscriptionItem(activeItems) {
	const deleted = [];
	Object.entries(activeItems).forEach(([key, value], index) => {
		if (index === 0) {
			deleted.push({ id: value, deleted: true });
		}
	});
	console.log(deleted);
	return deleted;
}

router.post('/setup-subscription', async (req, res, next) => {
	try {
		const { email } = req.query;
		const { stripeCustomerId, paymentMethodId, lookupKey } = req.body;
		const user = await db.User.findOne({ email });
		let subscription;
		let prices = (
			await stripe.prices.list({
				lookup_keys: [lookupKey, `${lookupKey}-commission`, 'multi-drop-commission', 'sms-commission'],
				expand: ['data.product']
			})
		).data;
		let { items, products } = orderPriceIds(prices);
		console.log(items.slice(0, 2));
		// check if user has an existing subscriptions
		if (user.subscriptionId) {
			// if they do, update the subscription plan price and standard commission price
			const deletedItems = deleteSubscriptionItem(user.subscriptionItems);
			subscription = await stripe.subscriptions.update(user.subscriptionId, {
				proration_behavior: 'create_prorations',
				items: [...items.slice(0, 2), ...deletedItems]
			});
		} else {
			// otherwise create a new subscription
			subscription = await stripe.subscriptions.create({
				customer: stripeCustomerId,
				items,
				default_payment_method: paymentMethodId,
				//TODO - add validation if user has already used their free trial
				trial_period_days: Number(process.env.STRIPE_TRIAL_PERIOD_DAYS)
			});
		}
		console.log('SUBSCRIPTION:', subscription);
		// attach the subscription id to the user
		const updatedUser = await db.User.findOneAndUpdate(
			{ email },
			{ subscriptionId: subscription.id, subscriptionPlan: lookupKey },
			{ new: true }
		);
		// fetch product details of the main plan price
		console.log(products[0]);
		const product = await stripe.products.retrieve(products[0]);
		console.table({ id: subscription.id, description: product.description, amount: prices[0].unit_amount });
		res.status(200).json({ id: subscription.id, description: product.description, amount: prices[0].unit_amount });
	} catch (err) {
		console.error(err);
		return next({
			status: err.status ? err.status : 400,
			message: err.message
		});
	}
});

router.get('/fetch-stripe-subscription', async (req, res, next) => {
	const { email } = req.query;
	try {
		const user = await db.User.findOne({ email });
		console.log(user['subscriptionId'], user['subscriptionPlan']);
		if (user['subscriptionId']) {
			const subscription = await stripe.subscriptions.retrieve(user['subscriptionId']);
			let product = {
				description:
					'Ideal for small businesses with less than 350 orders per month. The platform will not accept anymore than 350 orders.'
			};
			if (subscription && subscription.items.data) {
				console.log(subscription.items.data[0]);
				const productId = subscription.items.data[0].plan.product;
				product = await stripe.products.retrieve(productId);
				console.log('-----------------------------------------------');
				console.log(product);
			}
			res.status(200).json({
				id: subscription.id,
				name: user['subscriptionPlan'],
				description: product.description,
				status: subscription.status,
				items: subscription.items.data
			});
		} else {
			res.status(200).json({ id: '', name: '', status: null, items: [] });
		}
	} catch (e) {
		console.error(e);
		return next({
			status: 400,
			message: e.message
		});
	}
});

router.get('/cancel-subscription', async (req, res, next) => {
	try {
		const { email, reason } = req.query;
		console.log(email);
		// get the subscription id from the customer
		const user = await db.User.findOne({ email: email });
		console.log('User', user);
		if (user) {
			const subscription = await stripe.subscriptions.update(user.subscriptionId, { cancel_at_period_end: true });
			console.log(subscription);
			// send email to admins about the cancellation
			const message = `${user.firstname} ${user.lastname} has cancelled their subscription\n\nReason: ${reason}`;
			sendEmail({
				name: 'Ola Oladapo',
				email: 'ola@useseconds.com',
				subject: 'Subscription cancelled!',
				message
			}).then(() => console.log('email sent successfully'));
			sendEmail({
				name: 'Chisom Oguibe',
				email: 'chisom@useseconds.com',
				subject: 'Subscription cancelled!',
				message
			}).then(() => console.log('email sent successfully'));
			res.status(200).json({
				subscriptionId: subscription.id,
				cancelDate: subscription.cancel_at
			});
		} else {
			return next({
				status: 404,
				message: `No user found with email address ${email}`
			});
		}
	} catch (err) {
		console.error(err);
		return next({
			status: 400,
			message: err.message
		});
	}
});

router.get('/fetch-invoices', async (req, res, next) => {
	try {
		const { email } = req.query;
		const user = await db.User.findOne({ email });
		const invoices = await stripe.invoices.list({
			customer: user['stripeCustomerId'],
			limit: 5
		});
		console.log(invoices.data);
		res.status(200).json(invoices.data);
	} catch (err) {
		console.error(err);
		return next({
			status: 400,
			message: err.message
		});
	}
});

router.post('/create-checkout-session', async (req, res) => {
	const { lookup_key, stripe_customer_id, onboarding } = req.body;
	console.log('--------------------------------------');
	console.log('LOOKUP KEY:', lookup_key);
	console.log('--------------------------------------');
	const prices = await stripe.prices.list({
		lookup_keys: [lookup_key, `${lookup_key}-commission`, 'multi-drop-commission', 'sms-commission'],
		expand: ['data.product']
	});
	console.log(prices);
	/* ******************************************************** */
	let success_url = onboarding
		? `${String(process.env.CLIENT_HOST)}/signup/3/payment?success=true&session_id={CHECKOUT_SESSION_ID}`
		: `${String(process.env.CLIENT_HOST)}/subscription/payment?success=true&session_id={CHECKOUT_SESSION_ID}`;
	let cancel_url = onboarding
		? `${String(process.env.CLIENT_HOST)}/signup/3/payment?canceled=true`
		: `${String(process.env.CLIENT_HOST)}/subscription/payment?canceled=true`;
	/* ******************************************************** */
	const session = await stripe.checkout.sessions.create({
		customer: stripe_customer_id,
		billing_address_collection: 'auto',
		payment_method_types: ['card'],
		line_items: [
			{
				price: prices.data[0].id,
				// For metered billing, do not pass quantity
				quantity: 1,
				tax_rates: [`${process.env.STRIPE_TAX_EXCLUSIVE}`]
			},
			{
				price: prices.data[1].id,
				tax_rates: [`${process.env.STRIPE_TAX_EXCLUSIVE}`]
			},
			{
				price: prices.data[2].id,
				tax_rates: [`${process.env.STRIPE_TAX_EXCLUSIVE}`]
			},
			{
				price: prices.data[3].id,
				tax_rates: [`${process.env.STRIPE_TAX_EXCLUSIVE}`]
			}
		],
		mode: 'subscription',
		subscription_data: {
			trial_end: moment().add(1, 'month').unix()
		},
		success_url,
		cancel_url
	});
	res.redirect(303, session.url);
});

router.post('/create-portal-session', async (req, res) => {
	console.log(req.body);
	const { onboarding, stripe_customer_id } = req.body;
	console.log('--------------------------------------');
	console.log('CUSTOMER ID:', stripe_customer_id);
	console.log('--------------------------------------');
	let return_url = onboarding
		? `${String(process.env.CLIENT_HOST)}/signup/3`
		: `${String(process.env.CLIENT_HOST)}/subscription`;
	// managing their billing with the portal.
	const portalSession = await stripe.billingPortal.sessions.create({
		customer: stripe_customer_id,
		// This is the url to which the customer will be redirected when they are done
		return_url
	});
	console.log('------------------------------');
	console.log(portalSession);
	console.log('------------------------------');
	res.redirect(303, portalSession.url);
});

module.exports = router;
