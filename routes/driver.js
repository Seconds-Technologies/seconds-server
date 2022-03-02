const express = require('express');
const {
	verifyDriver,
	login,
	acceptJob,
	progressJob,
	uploadDeliverySignature,
	uploadDeliveryPhoto,
	downloadDeliveryProof
} = require('../helpers/driver');
const { upload } = require('../helpers');
const { S3_BUCKET_NAMES } = require('../constants');
const router = express.Router();

router.post('/verify', verifyDriver);
router.post('/login', login);
router.patch('/accept', acceptJob);
router.patch('/update-job', progressJob);
router.post('/upload-signature', uploadDeliverySignature);
router.post('/upload-photo', upload(S3_BUCKET_NAMES.DOCUMENTS).single('img'), uploadDeliveryPhoto);
router.post('/download-photo', downloadDeliveryProof);
module.exports = router;