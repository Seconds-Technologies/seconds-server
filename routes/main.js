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
				cb(null, `public/${shorthash.unique(file.originalname)}.jpg`);
			}
		})
	});

const {
	generateSecurityKeys,
	updateProfile,
	uploadProfileImage,
	updateDeliveryStrategies,
	synchronizeUserInfo,
	getOptimizedRoute,
	sendRouteOptimization,
	deleteOrders
} = require('../helpers/main');

const { getDrivers, createDriver, updateDriver, deleteDrivers } = require('../helpers/driver');

router.post('/token', generateSecurityKeys);
// user
router.get('/sync-user', synchronizeUserInfo);
router.post('/update-profile', updateProfile);
router.post('/update-delivery-strategies', updateDeliveryStrategies);
router.post('/upload', upload('seconds-profile-pictures').single('img'), uploadProfileImage);
//drivers
router.get('/drivers', getDrivers);
router.post('/create-driver', createDriver);
router.post('/update-driver', updateDriver);
router.patch('/delete-drivers', deleteDrivers);
// jobs
router.post('/optimise-route', sendRouteOptimization);
router.get('/optimise-route', getOptimizedRoute);
router.patch('/cancel-orders', deleteOrders)

module.exports = router;