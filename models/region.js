const mongoose = require("mongoose");

const regionSchema = new mongoose.Schema({
	Postcode: {
		type: String,
		required: true,
		unique: true
	}
});

module.exports = regionSchema;