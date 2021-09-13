const db = require("../models/index");
const jwt = require("jsonwebtoken");
const path = require("path");
const crypto = require("crypto");

const login = async (req, res, next) => {
	try {
		let user = await db.User.findOne({
			email: req.body.email
		});
		let {_id, firstname, lastname, email, company, createdAt, apiKey } = user;
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
			return res.status(200).json({
				id: _id, firstname, lastname, email, company, createdAt, token, apiKey,
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
	console.log("req.body:", req.body);
	try {
		//create a user
		let user = await db.User.create(req.file ? {...req.body, profileImageURL: req.file.path} : {...req.body});
		let {id, firstname, lastname, email, company, createdAt, apiKey} = user;
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
			apiKey,
			token,
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
		const { email } = req.body;
		const rand = crypto.randomBytes(24);
		let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".repeat(2)
		let apiKey = '';

		for (let i = 0; i < rand.length; i++) {
			let index = rand[i] % chars.length;
			apiKey += chars[index];
		}
		console.log("Generated API Key", apiKey);
		// update the user's details with the new api key
		await db.User.findOneAndUpdate({ email }, { "apiKey": apiKey }, { new: true });
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
		const { id, ...params } = req.body;
		console.log(id, params)
		const { firstname, lastname, email, company } = await db.User.findByIdAndUpdate(id, {...params}, { new: true})
		console.log("User",  { firstname, lastname, email, company })
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

module.exports = { register, login, generateSecurityKeys, updateProfile }