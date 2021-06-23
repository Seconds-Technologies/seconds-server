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
	password: {
		type: String,
		required: true
	},
	profileImageURL: {
		type: String,
		default: ""
	},
	shopDetails: {
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
	}
});

userSchema.pre("save", async function(next) {
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

userSchema.methods.comparePassword = async function(candidatePassword, next) {
	try {
		return await bcrypt.compare(candidatePassword, this.password);
	} catch (err) {
		console.error(err);
		return next(err);
	}
};

const User = mongoose.model("User", userSchema);

module.exports = User;