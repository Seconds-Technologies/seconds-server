const express = require("express");
const { verifyDriver, login, acceptJob, progressJob } = require('../helpers/driver');
const router = express.Router();

router.post('/verify', verifyDriver)
router.post('/login', login)
router.patch('/accept', acceptJob)
router.patch('/update-job', progressJob)

module.exports = router;