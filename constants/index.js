const AWS = require("aws-sdk");

exports.S3 = new AWS.S3({
	apiVersion: '2006-03-01',
	accessKeyId: process.env.S3_ACCESS_KEY,
	secretAccessKey: process.env.S3_SECRET_KEY,
	region: process.env.S3_BUCKET_REGION
})

exports.S3_BUCKET_NAMES = {
	PROFILE_IMAGE: "seconds-profile-pictures",
	DOCUMENTS: "seconds-delivery-documents"
}

exports.DRIVER_STATUSES = ['AVAILABLE', 'BUSY', 'OFFLINE']
exports.VEHICLES = ['BIC', 'MTB', 'CGB', 'CAR', 'VAN']

exports.DRIVER_STATUS = {
	AVAILABLE: "AVAILABLE",
	BUSY: "BUSY",
	OFFLINE: "OFFLINE"
}

exports.DISPATCH_OPTIONS = {
	DRIVER: "DRIVER",
	COURIER: "COURIER"
}