const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
	clientId: {
		type: mongoose.Schema.Types.ObjectId
	},
	stripeId: {
		type: mongoose.Schema.Types.String
	},
	name: {
		type: mongoose.Schema.Types.String
	},
	description: {
		type: mongoose.Schema.Types.String
	},
	price: {
		type: mongoose.Schema.Types.Number
	}
})

module.exports = subscriptionSchema