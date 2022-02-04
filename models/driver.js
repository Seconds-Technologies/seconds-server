const mongoose = require("mongoose");
const { DRIVER_STATUSES, VEHICLES } = require('../constants');
const moment = require('moment');

const driverSchema = new mongoose.Schema({
	clientId: {
		type: mongoose.Schema.Types.ObjectId,
		required: true
	},
	firstname: {
		type: String,
		required: true,
	},
	lastname: {
		type: String,
		required: true,
	},
	phone: {
		type: String,
		required: true,
	},
	vehicle: {
		type: String,
		required: true,
		enum: VEHICLES
	},
	email: {
		type: String,
		required: true,
	},
	status: {
		type: String,
		required: true,
		enum: DRIVER_STATUSES,
		default: "OFFLINE"
	},
	isOnline: {
		type: Boolean,
		required: true,
		default: false,
	},
	verified: {
		type: Boolean,
		required: true,
		default: false
	},
	createdAt: {
		type: Date,
		required: true,
		default: moment().format()
	},
});

module.exports = driverSchema;