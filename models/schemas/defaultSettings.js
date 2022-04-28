const { DISPATCH_OPTIONS, BATCH_OPTIONS } = require('@seconds-technologies/database_schemas/constants');

exports.defaultSettings = {
	sms: false,
	jobAlerts: {
		new: false,
		expired: false
	},
	defaultDispatch: DISPATCH_OPTIONS.COURIER,
	autoDispatch: {
		enabled: true,
		maxOrders: 3,
		onlineOnly: false
	},
	defaultBatchMode: BATCH_OPTIONS.DAILY,
	autoBatch: {
		enabled: false,
		daily: {
			deadline: '16:00',
			pickupTime: '17:00'
		},
		incremental: {
			batchInterval: 2,
			waitTime: 30
		}
	},
	driverResponseTime: 5,
	driverDeliveryFee: 5,
	courierPriceThreshold: 10,
	courierSelectionCriteria: 'eta',
	activeFleetProviders: {
		stuart: true,
		gophr: true,
		street_stream: true,
		ecofleet: false,
		addison_lee: false
	},
	routeOptimization: {
		vehicleTypes: {
			BIC: false,
			MTB: false,
			CGB: false,
			CAR: false,
			VAN: false
		},
		objectives: {
			mileage: true,
			duration: true,
			cost: true
		}
	}
};
