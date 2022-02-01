const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
	categoryId: {
		type: String,
		required: true
	},
	name: {
		type: String,
		required: true
	},
	ref: {
		type: String,
		required: true
	},
	description: {
		type: String
	},
	tags: {
		type: [String],
		default: []
	},
	defaultWeight: {
		type: Number,
		default: 0.5
	},
	parentRef: {
		type: String,
	},
	parentId: {
		type: mongoose.Schema.Types.ObjectId
	}
}, {_id: false});

module.exports = categorySchema;