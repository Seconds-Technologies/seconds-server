const AWS = require("aws-sdk");
const { EventBridge } = require("@aws-sdk/client-eventbridge");

exports.S3 = new AWS.S3({
	apiVersion: '2006-03-01',
	accessKeyId: process.env.AWS_ACCESS_KEY,
	secretAccessKey: process.env.AWS_SECRET_KEY,
	region: process.env.AWS_REGION
})

/*exports.S3 = new S3Client({
	region: process.env.AWS_REGION,
	apiVersion:'2006-03-01',
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
	}
});*/

exports.EventBridge = new EventBridge({
	apiVersion: "latest",
	region: process.env.AWS_REGION,
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY,
		secretAccessKey: process.env.AWS_SECRET_KEY,
	}
})

exports.S3_BUCKET_NAMES = {
	PROFILE_IMAGE: "seconds-profile-pictures",
	DOCUMENTS: "seconds-delivery-documents"
}

exports.DRIVER_STATUSES = ['AVAILABLE', 'BUSY', 'OFFLINE']
exports.VEHICLES_CODES = ['BIC', 'MTB', 'CGB', 'CAR', 'VAN']

exports.ROUTE_OPTIMIZATION_OBJECTIVES = {
	duration: 'less_duration',
	mileage: 'less_mileage',
	cost: 'minimize_cost'
};

exports.DRIVER_STATUS = {
	AVAILABLE: "AVAILABLE",
	BUSY: "BUSY",
	OFFLINE: "OFFLINE"
}

exports.MAGIC_BELL_CHANNELS = {
	ORDER_CREATED: "order_created",
	ORDER_DELIVERED: "order_delivered",
	ORDER_CANCELLED: "order_cancelled",
	JOB_ACCEPTED: "job_accepted",
	JOB_EXPIRED: "job_expired",
	NEW_DRIVER: "driver_registered",
	BUSINESS_WORKFLOWS: "business_workflows",
}

exports.COMMISSION_KEYS = {
	MULTI_DROP: 'multi-drop-commission',
	SMS: 'sms-commission'
}