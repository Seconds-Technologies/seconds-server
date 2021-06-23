const mongoose = require("mongoose");

const regionSchema = new mongoose.Schema({
	Postcode: {
		type: String,
		required: true,
		unique: true
	}
});

const PostCode = mongoose.model("Postcode", regionSchema);

module.exports = PostCode;