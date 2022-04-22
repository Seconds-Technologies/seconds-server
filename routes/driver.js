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
const { uploadDocument, uploadImage } = require('../helpers');
const { S3_BUCKET_NAMES } = require('../constants');
const { uploadProfileImage } = require('../helpers/main');
const router = express.Router();

router.post('/verify', verifyDriver);
router.post('/login', login);
//TODO - test with 'authenticateUser' middleware
router.patch('/accept', acceptJob);
router.patch('/update-job', progressJob);
router.post('/upload-signature', uploadDeliverySignature);
router.post('/upload-profile-picture', uploadImage(S3_BUCKET_NAMES.PROFILE_IMAGE).single('img'), uploadProfileImage);
router.post('/upload-delivery-photo', uploadDocument(S3_BUCKET_NAMES.DOCUMENTS).single('img'), uploadDeliveryPhoto);
router.post('/download-photo', downloadDeliveryProof);
router.patch('/update-location', updateDriverLocation)
module.exports = router;