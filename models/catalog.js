const { Schema } = require('mongoose');
const categorySchema = require('./schemas/categorySchema');
const productSchema = require('./schemas/productSchema');

const catalogSchema = new Schema({
	clientId: {
		type: Schema.Types.ObjectId,
		required: true
	},
	locationId: {
		type: String,
		required: true
	},
	catalogId: {
		type: String,
	},
	catalogName: {
		type: String,
	},
	categories: {
		type: [categorySchema],
	},
	products: {
		type: [productSchema],
	}
})

module.exports = catalogSchema;
