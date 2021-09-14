const express = require("express");
const {listJobs} = require("../helpers/jobs");
const router = express.Router();

router.post("/", listJobs)

module.exports = router;