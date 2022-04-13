require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../models');
const moment = require('moment');
const router = express.Router();

router.post('/setup-subscription', async (req, res) => {
	const { email, stripeCustomerId } = req.body;
	try {
		const subscription = await stripe.subscriptions.create({
			customer: stripeCustomerId,
			items: [{ price: process.env.STRIPE_SUBSCRIPTION_ID }]
		});
		console.log('SUBSCRIPTION:', subscription);
		//attach the subscription id to the user
		const updatedUser = db.User.findOneAndUpdate(
			{ email: email },
			{ stripeSubscriptionId: subscription.id },
			{ new: true }
		);
		console.log(updatedUser);
		res.status(200).json(subscription);
	} catch (e) {
		console.error(e);
		res.status(400).json({
			error: { ...e }
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
		const { email } = req.query;
		console.log(email);
		// get the subscription id from the customer
		const user = await db.User.findOne({ email: email });
		console.log('User', user);
		if (user) {
			const subscription = await stripe.subscriptions.update(user.subscriptionId, { cancel_at_period_end: true });
			console.log(subscription);
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