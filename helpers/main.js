const db = require('../models/index');
const crypto = require('crypto');
const { nanoid } = require('nanoid');
const shorthash = require('shorthash');
const { S3 } = require('../constants/index');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getBase64Image } = require('../helpers')

const generateSecurityKeys = async (req, res, next) => {
	// generate the apiKey using random byte sequences
	try {
		const { email, strategy } = req.body;
		const rand = crypto.randomBytes(24);
		let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.repeat(2);
		let apiKey = '';

		for (let i = 0; i < rand.length; i++) {
			let index = rand[i] % chars.length;
			apiKey += chars[index];
		}
		console.log('Generated API Key', apiKey);
		// update the user's details with the new api key and their strategy
		await db.User.findOneAndUpdate({ email }, { apiKey: apiKey, selectionStrategy: strategy }, { new: true });
		// return the new apiKey
		return res.status(201).json({
			apiKey,
		});
	} catch (err) {
		return next({
			status: 400,
			message: err.message,
		});
	}
};

const updateProfile = async (req, res, next) => {
	try {
		const { id, data } = req.body;
		// update user info in database
		const { firstname, lastname, email, company, stripeCustomerId, phone } = await db.User.findByIdAndUpdate(
			id,
			{ ...data },
			{ new: true }
		);
		console.log('Stripe Customer', stripeCustomerId);
		// update stripe info
		const customer = await stripe.customers.update(stripeCustomerId, {
			email,
			name: `${firstname} ${lastname}`,
			phone,
		});
		console.log(customer);
		return res.status(200).json({
			firstname,
			lastname,
			email,
			company,
			message: 'Profile updated successfully!',
		});
	} catch (err) {
		if (err.code === 11000) {
			err.message = 'Sorry, that email is taken!';
		}
		console.error(err);
		return next({
			status: 400,
			message: err.message,
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
				'profileImage.location': location,
			},
			{ new: true }
		);
		console.log(profileImage);
		// retrieve image object from s3 convert to base64
		let base64Image = await getBase64Image(filename);
		return res.status(200).json({
			base64Image,
			message: 'image uploaded!',
		});
	} catch (err) {
		return next({
			status: 400,
			message: err.message,
		});
	}
};

module.exports = {
	generateSecurityKeys,
	updateProfile,
	uploadProfileImage
};