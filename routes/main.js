const express = require('express');
const router = express.Router();
const multer = require('multer');
const multerS3 = require('multer-s3');
const shorthash = require('shorthash');
const { S3 } = require('../constants/index');

const upload = bucket =>
	multer({
		storage: multerS3({
			s3: S3,
			bucket,
			metadata: function (req, file, cb) {
				cb(null, { fieldName: file.fieldname });
			},
			key: function (req, file, cb) {
				cb(null, `${shorthash.unique(file.originalname)}.jpg`);
			}
		})
	});

const {
	generateSecurityKeys,
	updateProfile,
	updateDeliveryHours,
	uploadProfileImage,
	updateDeliveryStrategies,
	synchronizeUserInfo
} = require('../helpers/main');

const { createDriver, updateDriver } = require('../helpers/driver');

router.post('/token', generateSecurityKeys);
router.post('/update-profile', updateProfile);
router.post('/update-delivery-hours', updateDeliveryHours);
router.post('/update-delivery-strategies', updateDeliveryStrategies);
router.post('/upload', upload('seconds-profile-pictures').single('img'), uploadProfileImage);
router.get('/sync-user', synchronizeUserInfo);
router.post('/create-driver', createDriver);
router.post('/update-driver', updateDriver);

module.exports = router;