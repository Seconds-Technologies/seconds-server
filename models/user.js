const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
	email: {
		type: String,
		required: true,
		unique: true
	},
	firstname: {
		type: String,
		required: true
	},
	lastname: {
		type: String,
		required: true
	},
	company: {
		type: String,
		required: true
	},
	phone:{
		type: String,
		required: true
	},
	address: {
		type: String,
		required: true
	},
	password: {
		type: String,
		required: true
	},
	profileImage: {
		file: {
			type: String,
			default: ""
		}
	},
	shopify: {
		orders: [],
		products: [],
		shopId: String,
		shopOwner: String,
		country: String,
		domain: String,
		baseURL: String,
		accessToken: String
	},
	createdAt: {
		type: Date,
		default: Date.now()
	},
	apiKey: {
		type: String,
		default: ""
	},
	selectionStrategy: {
		type: String,
		default: "eta"
	},
	stripeCustomerId: {
		type: String,
		default: "",
	},
	paymentMethodId: {
		type: String,
		default: "",
	},
	subscriptionId: {
		type: String,
		default: ""
	},
	jobs: []
});

userSchema.pre("save", async function (next) {
	try {
		if (!this.isModified("password")) {
			return next();
		}
		this.password = await bcrypt.hash(this.password, 10);
		return next();
	} catch (err) {
		return next(err);
	}
});

userSchema.methods.comparePassword = async function (candidatePassword, next) {
	try {
		return await bcrypt.compare(candidatePassword, this.password);
	} catch (err) {
		console.error(err);
		return next(err);
	}
};

module.exports = userSchema;