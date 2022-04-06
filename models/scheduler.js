const mongoose = require('mongoose');

const schedulerSchema = new mongoose.Schema({
	dailyBatching: {
		enabled: {
			type: mongoose.Schema.Types.Boolean,
			default: false
		},
		id: {
			type: String,
		}
	},
	hourlyBatching: {
		enabled: {
			type: mongoose.Schema.Types.Boolean,
			default: false
		},
		id: {
			type: String,
		}
	}
})

module.exports = schedulerSchema