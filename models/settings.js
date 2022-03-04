const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema({
	clientId: {
		type: mongoose.Schema.Types.ObjectId,
		required: true
	},
	defaultDispatch: {
		type: String,
		enum: []
	},
	sms: {
		type: mongoose.Schema.Types.Boolean,
		default: false
	},
	autoDispatch: {
		enabled: {
			type: mongoose.Schema.Types.Boolean,
			default: false
		},
		maxOrders: {
			type: mongoose.Schema.Types.Number,
			default: 3
		},
		onlineOnly: {
			type: mongoose.Schema.Types.Boolean,
			default: false
		}
	},
	driverResponseTime: {
		type: mongoose.Schema.Types.Number,
		default: 5
	},
	driverDeliveryFee: {
		type: mongoose.Schema.Types.Number,
		default: 5,
	},
	courierPriceThreshold: {
		type: mongoose.Schema.Types.Number,
		default: 10
	},
	courierSelectionCriteria: {
		type: String,
		default: "eta"
	}
});