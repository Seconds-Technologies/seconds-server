const AWS = require("aws-sdk");

exports.S3 = new AWS.S3({
	apiVersion: '2006-03-01',
	accessKeyId: process.env.S3_ACCESS_KEY,
	secretAccessKey: process.env.S3_SECRET_KEY,
	region: process.env.S3_BUCKET_REGION
})