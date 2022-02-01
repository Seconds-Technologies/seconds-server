const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
	variantId: {
		type: String,
		required: true,
	},
	ref: {
		type: String,
		required: true
	},
	name: {
		type: String,
	},
	price: {
		type: mongoose.Schema.Types.Number,
	},
	productId: {
		type: String,
		required: true
	},
	weight: {
		type: Number,
		default: 0.5
	},
	options: {
		type: Array,
		default: [],
	}
}, {_id: false})

const productSchema = new mongoose.Schema({
	productId: {
		type: String,
		required: true
	},
	name: {
		type: String,
		required: true
	},
	categoryId: {
		type: String,
	},
	description: {
		type: String,
	},
	tags: {
		type: [String],
		default: [],
	},
	variants: [variantSchema]
}, {_id: false});

module.exports = productSchema;