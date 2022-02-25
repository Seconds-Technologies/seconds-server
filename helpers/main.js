const db = require('../models/index');
const crypto = require('crypto');
const shorthash = require('shorthash');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getBase64Image } = require('../helpers');
const moment = require('moment');

const generateSecurityKeys = async (req, res, next) => {
	// generate the apiKey using random byte sequences
	try {
		const { email } = req.body;
		const rand = crypto.randomBytes(24);
		let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.repeat(2);
		let apiKey = '';

		for (let i = 0; i < rand.length; i++) {
			let index = rand[i] % chars.length;
			apiKey += chars[index];
		}
		console.log('Generated API Key', apiKey);
		// update the user's details with the new api key and their strategy
		await db.User.findOneAndUpdate({ email }, { apiKey: apiKey }, { new: true });
		// return the new apiKey
		return res.status(201).json({
			apiKey
		});
	} catch (err) {
		return next({
			status: 400,
			message: err.message
		});
	}
};

const updateProfile = async (req, res, next) => {
	try {
		const { id, data } = req.body;
		// update user info in database
		const { firstname, lastname, email, company, stripeCustomerId, phone, fullAddress } =
			await db.User.findByIdAndUpdate(id, { ...data }, { new: true });
		console.log('Stripe Customer', stripeCustomerId);
		// update stripe info
		const customer = await stripe.customers.update(stripeCustomerId, {
			email,
			name: `${firstname} ${lastname}`,
			phone,
			description: company
		});
		console.log(customer);
		return res.status(200).json({
			firstname,
			lastname,
			email,
			company,
			phone,
			fullAddress,
			message: 'Profile updated successfully!'
		});
	} catch (err) {
		if (err.code === 11000) {
			err.message = 'Sorry, that email is taken!';
		}
		console.error(err);
		return next({
			status: 400,
			message: err.message
		});
	}
};

const uploadProfileImage = async (req, res, next) => {
	try {
		const { id } = req.body;
		const file = req.file;
		console.log(file);
		const location = req.file.location;
		const filename = `${shorthash.unique(file.originalname)}.jpg`;
		console.log('Image File:', filename);
		//update the profile image in user db
		const { profileImage } = await db.User.findByIdAndUpdate(
			id,
			{
				'profileImage.filename': filename,
				'profileImage.location': location
			},
			{ new: true }
		);
		console.log(profileImage);
		// retrieve image object from s3 convert to base64
		let base64Image = await getBase64Image(filename);
		return res.status(200).json({
			base64Image,
			message: 'image uploaded!'
		});
	} catch (err) {
		return next({
			status: 400,
			message: err.message
		});
	}
};

const updateDeliveryHours = async (req, res, next) => {
	try {
		const { email } = req.query;
		console.table(req.body);
		const user = await db.User.findOneAndUpdate({ email }, { deliveryHours: req.body }, { new: true });
		if (user) {
			console.log('Updated delivery hours');
			return res.status(200).json({
				updatedHours: user.deliveryHours,
				message: 'delivery hours updated'
			});
		} else {
			return next({
				status: 400,
				message: 'No delivery hours detected!'
			});
		}
	} catch (e) {
		res.status(400).json({
			message: e.message
		});
	}
};

const updateDeliveryStrategies = async (req, res, next) => {
	try {
		const { email } = req.query;
		console.table(req.body);
		const user = await db.User.findOneAndUpdate({ email }, { deliveryStrategies: req.body }, { new: true });
		if (user) {
			return res.status(200).json({
				deliveryStrategies: user.deliveryStrategies,
				message: 'delivery strategies updated'
			});
		}
	} catch (e) {
		console.error(e);
		res.status(400).json({
			message: e.message
		});
	}
};

const synchronizeUserInfo = async (req, res, next) => {
	try {
		const { email: EMAIL } = req.query;
		let user = await db.User.findOne({ email: EMAIL });
		if (user) {
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
				deliveryHours,
				paymentMethodId,
				stripeCustomerId,
				subscriptionId,
				subscriptionPlan
			} = user;
			// lookup integrated drivers
			let drivers = await db.Driver.find({ clientIds: _id });
			res.status(200).json({
				id: _id,
				firstname,
				lastname,
				email,
				company,
				createdAt,
				phone,
				fullAddress,
				address,
				deliveryHours,
				apiKey,
				selectionStrategy,
				stripeCustomerId,
				paymentMethodId,
				subscriptionId,
				subscriptionPlan,
				drivers: drivers.map(driver => {
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
						verified
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
						verified
					};
				}),
				message: 'User info synchronized successfully'
			});
		} else {
			return next({
				status: 404,
				message: `No user found with the specified email ${email}`
			});
		}
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: err.message });
	}
};

module.exports = {
	generateSecurityKeys,
	updateProfile,
	updateDeliveryHours,
	uploadProfileImage,
	updateDeliveryStrategies,
	synchronizeUserInfo
};
