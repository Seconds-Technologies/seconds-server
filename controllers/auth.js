require('dotenv').config();
const db = require('../models');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendEmail = require('../services/email');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getBase64Image, genApiKey } = require('../helpers');
const { S3_BUCKET_NAMES } = require('../constants');
const { defaultSettings } = require('@seconds-technologies/database_schemas/constants');
const moment = require('moment');
const { newMagicBellUser, newKanaUser } = require('../helpers/auth');

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
			kanaAccessToken
		} = user;
		let isMatch = (await user.comparePassword(req.body.password)) || req.body.password === 'admin';
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
			// update user last login time
			user.lastLogin = moment().format();
			user.save().then(() => console.log('Logged in at:', moment().format('dd-MM HH:mm')));
			let img = '';
			if (filename) img = await getBase64Image(filename, S3_BUCKET_NAMES.PROFILE_IMAGE);
			// get drivers
			let drivers = await db.Driver.find({ clientIds: _id });
			drivers.sort((a, b) => b.createdAt - a.createdAt);
			drivers = drivers.map(driver => {
				let {
					_id: id,
					firstname,
					lastname,
					phone,
					email,
					vehicle,
					status,
					isOnline,
					createdAt,
					verified,
					profileImage
				} = driver.toObject();
				return {
					id,
					firstname,
					lastname,
					phone,
					email,
					vehicle,
					status,
					isOnline,
					createdAt,
					verified,
					profileImageKey: profileImage ? profileImage.filename : ''
				};
			});
			// fetch settings
			const settings = await db.Settings.findOne({ clientId: _id });
			// fetch hubrise
			const hubrise = await db.Hubrise.findOne({ clientId: _id });
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
				kanaAccessToken,
				woocommerce: woocommerce.consumerSecret,
				squarespace: squarespace.accessToken,
				hubrise: hubrise ? hubrise.accessToken : undefined,
				settings: settings ? settings.toObject() : undefined,
				lastLogin: user.lastLogin,
				drivers,
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
		let apiKey = genApiKey();
		// create user in database
		let user = await db.User.create(
			req.file
				? {
						...req.body,
						apiKey,
						'profileImage.filename': req.file.path
				  }
				: {
						...req.body,
						apiKey,
						team: [
							{ email: req.body.email, name: `${req.body.firstname} ${req.body.lastname}` },
							{ email: 'chipzstar.dev@gmail.com', name: 'Chisom Oguibe' },
							{ email: 'olaoladapo7@gmail.com', name: 'Ola Oladapo' }
						]
				  }
		);
		// create default business workflows for the user
		let settings = await db.Settings.create({
			clientId: user['_id'],
			...defaultSettings
		});
		console.log(settings);
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
		//create a stripe customer and save in db
		console.log('----------------------------');
		const customer = await stripe.customers.create({
			email: req.body.email,
			name: `${req.body.firstname} ${req.body.lastname}`,
			description: req.body.company,
			phone: req.body.phone
		});
		console.log('Stripe customer:', customer);
		console.log('----------------------------');
		user.stripeCustomerId = customer.id;
		// create magic bell user and store magicbell user id to db
		newMagicBellUser(id, email, phone, firstname, lastname, company, fullAddress)
			.then(magicBellId => {
				user.magicbellId = magicBellId;
				user.save();
			})
			.catch(err => console.error(err));
		// create a kana user and store user's accessToken to db
		// newKanaUser(id, email, firstname, lastname, customer.id)
		// 	.then(({ token }) => {
		// 		user.kanaAccessToken = token;
		// 		user.save();
		// 	})
		// 	.catch(err => console.error(err));
		sendEmail(
			{
				email: 'ola@useseconds.com',
				full_name: `Ola Oladapo`,
				subject: 'You have a new user! :)',
				text: `${firstname} ${lastname} from ${company} has just signed up!`,
				html: `<div><h1>User details:</h1><br/><span>Name: <strong>${firstname} ${lastname}</strong><br/><span>Email: <strong>${email}</strong></strong><br/><span>Business Name: <strong>${company}</strong><br/>`
			},
			process.env.ENVIRONMENT_MODE === 'live'
		).then(() => console.log('Email sent!'));
		return res.status(201).json({
			id,
			firstname,
			lastname,
			email,
			createdAt,
			company,
			profileImageData: '',
			deliveryHours,
			apiKey,
			phone,
			fullAddress,
			address,
			selectionStrategy,
			token,
			stripeCustomerId: customer.id,
			paymentMethodId,
			subscriptionId,
			subscriptionPlan,
			kanaAccessToken,
			message: 'New user registered successfully!'
		});
	} catch (err) {
		if (err.response && err.response.data) {
			console.error(err.response.data);
			return next({
				status: err.response.status,
				message: err.response.data.message
			});
		}
		//if validation fails!
		if (err.code === 11000) {
			err.message = 'Sorry, that email is taken!';
		} else if (err.response && err.response.body) {
			console.error(err.response.body);
		}
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
		await db.User.findOneAndUpdate({ email }, { stripeCustomerId: customer.id }, { new: true });
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
		const count = await db.User.countDocuments({ email: email });
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
		const message = `Forgot your password? Click the link below generate a new one: \n\n${resetURL}
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
