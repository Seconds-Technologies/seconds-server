const db = require("../models/index");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const {nanoid} = require('nanoid')
const shorthash = require("shorthash");
const {S3} = require('../constants/index');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

function encode(data){
	let buf = Buffer.from(data);
	return buf.toString('base64');
}

async function getBase64Image(filename){
	if (filename) {
		const data = await S3.getObject({
			Bucket: 'seconds-profile-pictures',
			Key: filename
		}).promise();
		console.log(data);
		return encode(data.Body)
	}
	return ""
}

const login = async (req, res, next) => {
	console.log(req.body)
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
			address,
			company,
			createdAt,
			apiKey,
			selectionStrategy,
			shopify,
			paymentMethodId,
			profileImage: {filename},
			stripeCustomerId,
			subscriptionId
		} = user;
		let isMatch = await user.comparePassword(req.body.password);
		if (isMatch) {
			let token = jwt.sign({
					_id,
					firstname,
					lastname,
					email
				},
				process.env.SECRET_KEY
			);
			let img = ""
			if (filename) img = await getBase64Image(filename)
			return res.status(200).json({
				id: _id,
				firstname,
				lastname,
				email,
				company,
				createdAt,
				phone,
				address,
				profileImageData: img,
				shopify: shopify.accessToken,
				token,
				apiKey,
				selectionStrategy,
				stripeCustomerId,
				paymentMethodId,
				subscriptionId,
				message: "You have logged in Successfully!"
			});
		} else {
			return next({
				status: 400,
				message: "Invalid Email/Password"
			});
		}
	} catch (err) {
		console.error(err);
		return next({
			status: 400,
			message: "Invalid Email/Password"
		});
	}
};

const register = async (req, res, next) => {
	try {
		//create a user
		console.log('----------------------------')
		const customer = await stripe.customers.create({
			email: req.body.email,
			name: `${req.body.firstname} ${req.body.lastname}`,
			description: req.body.company
		});
		console.log(customer)
		console.log('----------------------------')
		// req.body.stripeCustomerId = customer.id;
		// console.log(req.body.stripeCustomerId);
		let user = await db.User.create(req.file ? {
			...req.body,
			"profileImage.file": req.file.path,
			"stripeCustomerId": customer.id
		} : {...req.body, "stripeCustomerId": customer.id});
		let {
			id,
			firstname,
			lastname,
			email,
			company,
			phone,
			address,
			createdAt,
			apiKey,
			paymentMethodId,
			selectionStrategy,
			subscriptionId,
			shopify,
			profileImage: {data: profileImageData},
			stripeCustomerId
		} = user;
		//create a jwt token
		let token = jwt.sign({
				id,
				firstname,
				lastname,
				email
			},
			process.env.SECRET_KEY
		);
		return res.status(201).json({
			id,
			firstname,
			lastname,
			email,
			createdAt,
			company,
			profileImageData,
			shopify: shopify.accessToken,
			apiKey,
			phone,
			address,
			selectionStrategy,
			token,
			stripeCustomerId,
			paymentMethodId,
			subscriptionId,
			message: "New user registered successfully!"
		});
	} catch (err) {
		//if validation fails!
		if (err.code === 11000) {
			err.message = "Sorry, that email is taken!";
		}
		console.error(err);
		return next({
			status: 400,
			message: err.message
		});
	}
};

const generateSecurityKeys = async (req, res, next) => {
	// generate the apiKey using random byte sequences
	try {
		const {email, strategy} = req.body;
		const rand = crypto.randomBytes(24);
		let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".repeat(2)
		let apiKey = '';

		for (let i = 0; i < rand.length; i++) {
			let index = rand[i] % chars.length;
			apiKey += chars[index];
		}
		console.log("Generated API Key", apiKey);
		// update the user's details with the new api key and their strategy
		await db.User.findOneAndUpdate({email}, {"apiKey": apiKey, "selectionStrategy": strategy}, {new: true});
		// return the new apiKey
		return res.status(201).json({
			apiKey
		});
	} catch (err) {
		return next({
			status: 400,
			message: err.message
		})
	}
}

const updateProfile = async (req, res, next) => {
	try {
		const {id, ...params} = req.body;
		const {firstname, lastname, email, company} = await db.User.findByIdAndUpdate(id, {...params}, {new: true})
		console.log("User", {id, firstname, lastname, email, company})
		return res.status(200).json({
			firstname,
			lastname,
			email,
			company,
			message: "Profile updated successfully!"
		})
	} catch (err) {
		return next({
			status: 400,
			message: err.message
		})
	}
}

const uploadProfileImage = async (req, res, next) => {
	try {
		const {id} = req.body;
		const file = req.file;
		console.log(file)
		const location = req.file.location;
		const filename = `${shorthash.unique(file.originalname)}.jpg`
		console.log("Image File:", filename)
		//update the profile image in user db
		const {profileImage} = await db.User.findByIdAndUpdate(id, {
			"profileImage.filename": filename,
			"profileImage.location": location
		}, {new: true})
		console.log(profileImage)
		let base64Image = await getBase64Image(filename)
		//let img = fs.readFileSync(location, {encoding: 'base64'})
		return res.status(200).json({
			base64Image,
			message: "image uploaded!"
		})
	} catch (err) {
		return next({
			status: 400,
			message: err.message
		})
	}
}

module.exports = {register, login, generateSecurityKeys, updateProfile, uploadProfileImage}