const mongoose = require('mongoose');

const pointSchema = new mongoose.Schema({
	type: {
		type: String,
		enum: ['Point'],
		required: true,
		default: 'Point'
	},
	coordinates: {
		type: [Number],
		required: false
	}
});

const addressSchema = new mongoose.Schema({
	street: {
		type: String,
		default: ''
	},
	city: {
		type: String,
		default: ''
	},
	postcode: {
		type: String,
		default: ''
	},
	countryCode: {
		type: String,
		default: 'GB'
	},
	geolocation: {
		type: pointSchema,
		index: '2dsphere'
	}
}, {_id: false});

module.exports = addressSchema;