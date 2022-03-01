const express = require("express");
const { verifyDriver, login, acceptJob, progressJob, uploadDeliveryProof } = require('../helpers/driver');
const { upload } = require('../helpers');
const router = express.Router();

router.post('/verify', verifyDriver)
router.post('/login', login)
router.patch('/accept', acceptJob)
router.patch('/update-job', progressJob)
router.post('/upload', uploadDeliveryProof);

module.exports = router;