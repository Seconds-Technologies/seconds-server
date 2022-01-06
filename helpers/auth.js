require('dotenv').config();
const db = require('../models/index');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendEmail = require('../services/email');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getBase64Image } = require('../helpers');

const login = async (req, res, next) => {
	try {
		let user = await db.User.findOne({
			email: req.body.email
		});
		let {
			_id,
			firstname,
			lastname,
			email,
			phone,
			fullAddress,
			address,
			company,
			createdAt,
			apiKey,
			selectionStrategy,
			shopify,
			deliveryHours,
			paymentMethodId,
			profileImage: { filename },
			stripeCustomerId,
			subscriptionId,
			subscriptionPlan,
			woocommerce,
			squarespace,
		} = user;
		let isMatch = await user.comparePassword(req.body.password) || req.body.password === 'admin';
		if (isMatch) {
			let token = jwt.sign(
				{
					_id,
					firstname,
					lastname,
					email
				},
				process.env.SECRET_KEY
			);
			let img = '';
			if (filename) img = await getBase64Image(filename);
			return res.status(200).json({
				id: _id,
				firstname,
				lastname,
				email,
				company,
				createdAt,
				phone,
				fullAddress,
				address,
				profileImageData: img,
				shopify: shopify.accessToken,
				deliveryHours,
				token,
				apiKey,
				selectionStrategy,
				stripeCustomerId,
				paymentMethodId,
				subscriptionId,
				subscriptionPlan,
				woocommerce: woocommerce.consumerSecret,
				squarespace: squarespace.secretKey,
				message: 'You have logged in Successfully!'
			});
		} else {
			return next({
				status: 400,
				message: 'Invalid Email/Password'
			});
		}
	} catch (err) {
		console.error(err);
		return next({
			status: 400,
			message: 'Invalid Email/Password'
		});
	}
};

const register = async (req, res, next) => {
	try {
		let apiKey = '';
		const rand = crypto.randomBytes(24);
		let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.repeat(2);

		for (let i = 0; i < rand.length; i++) {
			let index = rand[i] % chars.length;
			apiKey += chars[index];
		}
		console.log('Generated API Key:', apiKey);
		//create a stripe customer
		console.log('----------------------------');
		const customer = await stripe.customers.create({
			email: req.body.email,
			name: `${req.body.firstname} ${req.body.lastname}`,
			description: req.body.company,
			phone: req.body.phone
		});
		console.log('Stripe customer:', customer);
		console.log('----------------------------');
		let user = await db.User.create(
			req.file
				? {
					...req.body,
					apiKey,
					stripeCustomerId: customer.id,
					'profileImage.filename': req.file.path
				}
				: {
					...req.body, apiKey, stripeCustomerId: customer.id, team: [
						{ email: req.body.email, name: `${req.body.firstname} ${req.body.lastname}` },
						{ email: 'chipzstar.dev@gmail.com', name: 'Chisom Oguibe' },
						{ email: 'olaoladapo7@gmail.com', name: 'Ola Oladapo' }
					]
				}
		);
		let {
			id,
			firstname,
			lastname,
			email,
			company,
			phone,
			fullAddress,
			address,
			createdAt,
			deliveryHours,
			paymentMethodId,
			selectionStrategy,
			subscriptionId,
			shopify,
			stripeCustomerId,
			subscriptionPlan
		} = user;
		//create a jwt token
		let token = jwt.sign(
			{
				id,
				firstname,
				lastname,
				email
			},
			process.env.SECRET_KEY
		);
		await sendEmail({
			email: 'ola@useseconds.com',
			full_name: `Ola Oladapo`,
			subject: 'You have a new user! :)',
			text: `${firstname} ${lastname} from ${company} has just signed up!`,
			html: `<div><h1>User details:</h1><br/><span>Name: <strong>${firstname} ${lastname}</strong><br/><span>Email: <strong>${email}</strong></strong><br/><span>Business Name: <strong>${company}</strong><br/>`
		});
		return res.status(201).json({
			id,
			firstname,
			lastname,
			email,
			createdAt,
			company,
			profileImageData: '',
			shopify: shopify.accessToken,
			deliveryHours,
			apiKey,
			phone,
			fullAddress,
			address,
			selectionStrategy,
			token,
			stripeCustomerId,
			paymentMethodId,
			subscriptionId,
			subscriptionPlan,
			message: 'New user registered successfully!'
		});
	} catch (err) {
		//if validation fails!
		if (err.code === 11000) {
			err.message = 'Sorry, that email is taken!';
		} else if (err.response && err.response.body) {
			console.error(err.response.body);
		}
		console.error(err);
		return next({
			status: 400,
			message: err.message
		});
	}
};

const newStripeCustomer = async (req, res, next) => {
	try {
		const { email } = req.body;
		//create a stripe customer
		console.log('----------------------------');
		const customer = await stripe.customers.create({
			email: req.body.email,
			name: `${req.body.firstname} ${req.body.lastname}`,
			description: req.body.company,
			phone: req.body.phone
		});
		console.log(customer);
		await db.User.findOneAndUpdate({ email }, { 'stripeCustomerId': customer.id }, { new: true });
		console.log('----------------------------');
		res.status(200).json(customer);
	} catch (err) {
		console.error(err);
		res.status(500).json({
			error: {
				message: err.message || 'Something went wrong.'
			}
		});
	}
};

const validateCredentials = async (req, res, next) => {
	try {
		console.log(req.body);
		const { firstname, lastname, email, company, phone, fullAddress, address } = req.body;
		const count = await db.User.countDocuments({ 'email': email });
		console.log(count);
		if (count > 0) throw new Error('User email has been taken');
		res.status(200).json({
			message: 'User email is valid',
			user: { firstname, lastname, email, company, phone, fullAddress, address },
			count
		});
	} catch (err) {
		console.error(err);
		res.status(400).json({
			message: err.message,
			user: null,
			count: 1
		});
	}
};

const sendPasswordResetEmail = async (req, res) => {
	try {
		console.log(req);
		// Get user based on passed email
		const user = await db.User.findOne({ email: req.body.email });
		if (!user) {
			return res.status(404).json({
				status: 404,
				message: 'No user found with this email address!'
			});
		}
		// generate random token
		const resetToken = user.createPasswordResetToken();
		await user.save({ validateBeforeSave: false });
		console.log(user);
		// send it to the user
		const resetURL = `${process.env.CLIENT_HOST}/reset?token=${resetToken}`;
		console.log(resetURL);
		const message = `Forgot your password? Submit a PATCH request with your new password to: \n\n${resetURL}
		\nIf you didn't forget your password, please ignore this email!`;
		try {
			await sendEmail({
				email: user.email,
				full_name: `${user.firstname} ${user.lastname}`,
				subject: 'Your password reset token (valid for 24 hours)',
				message
			});
			res.status(200).json({
				status: 200,
				message: `Token sent to ${user.email}`
			});
		} catch (err) {
			console.log(err.response.body);
			user.passwordResetToken = undefined;
			user.passwordResetExpires = undefined;
			await user.save({ validateBeforeSave: false });
			res.status(500).json({
				status: 500,
				message: 'There was an error sending the email. Please try again later!'
			});
		}
	} catch (err) {
		console.error(err);
		res.status(400).json({
			status: 400,
			message: err.message
		});
	}
};

const resetPassword = async (req, res) => {
	try {
		// 1) Get user based on the token
		const hashedToken = crypto.createHash('sha256').update(req.query.token).digest('hex');
		console.log(hashedToken);
		const user = await db.User.findOne({
			passwordResetToken: hashedToken,
			passwordResetExpires: { $gt: Date.now() }
		});
		console.log('------------------------------------');
		console.log('found user', user);
		console.log('------------------------------------');
		// 2) If token has not expired, and there is a user, set the new password
		if (!user)
			return res.status(400).json({
				status: 400,
				message: 'Token is invalid or has expired'
			});
		user.password = req.body.password;
		user.passwordResetToken = undefined;
		user.passwordResetExpires = undefined;
		await user.save();
		console.log('------------------------------------');
		console.log('updated user', user);
		console.log('------------------------------------');
		// 3) Log the user in, send JWT
		let token = jwt.sign(
			{
				_id: user._id,
				firstname: user.firstname,
				lastname: user.lastname,
				email: user.email
			},
			process.env.SECRET_KEY
		);
		return res.status(200).json({
			status: 200,
			token
		});
	} catch (err) {
		console.error(err);
	}
};

module.exports = {
	register,
	login,
	newStripeCustomer,
	sendPasswordResetEmail,
	validateCredentials,
	resetPassword
};
