const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3 } = require('../constants');
const shorthash = require('shorthash');
const { S3_BUCKET_NAMES } = require('@seconds-technologies/database_schemas/constants');

const wooCommerceTimeout = (err, req, res, next) => {
	console.log("TIMEOUT", req.timedout)
	!req.timedout && next()
}

const profileImageUploadAWS = (req, res, next) => {
	const upload = multer({
		storage: multerS3({
			s3: S3,
			bucket: S3_BUCKET_NAMES.PROFILE_IMAGE,
			metadata: function (req, file, cb) {
				cb(null, { fieldName: file.fieldname });
			},
			key: function (req, file, cb) {
				cb(null, `${shorthash.unique(file.originalname)}.jpg`);
			}
		})
	}).single('img');
	// Custom error handling for multer
	upload(req, res, error => {
		console.log("Response:", res)
		if (error instanceof multer.MulterError)
			return res.status(400).json({
				message: 'Upload unsuccessful',
				errorMessage: error.message,
				errorCode: error.code
			});

		if (error) {
			return res.status(500).json({
				message: error.message
			});
		}
		console.log('Upload successful.');
		next();
	});
};

module.exports = { profileImageUploadAWS, wooCommerceTimeout };