const express = require('express');
const {
	verifyDriver,
	login,
	acceptJob,
	progressJob,
	uploadDeliverySignature,
	uploadDeliveryPhoto,
	downloadDeliveryProof,
	updateDriverLocation
} = require('../helpers/driver');
const { upload } = require('../helpers');
const { S3_BUCKET_NAMES } = require('../constants');
const router = express.Router();

router.post('/verify', verifyDriver);
router.post('/login', login);
//TODO - test with 'authenticateUser' middleware
router.patch('/accept', acceptJob);
router.patch('/update-job', progressJob);
router.post('/upload-signature', uploadDeliverySignature);
router.post('/upload-photo', upload(S3_BUCKET_NAMES.DOCUMENTS).single('img'), uploadDeliveryPhoto);
router.post('/download-photo', downloadDeliveryProof);
router.patch('/update-location', updateDriverLocation)
module.exports = router;