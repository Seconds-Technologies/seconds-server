require("dotenv").config();
const express = require("express");
const db = require("../models/index");
const axios = require("axios");
const moment = require("moment-timezone");

exports.listJobs = async (req, res, next) => {
	try {
		const jobs = db.Job.find({})
	    return res.status(200).json({
		    jobs,
		    message: "All jobs returned!"
	    })
	} catch (err) {
	    console.error(err)
		return next({
			status: 400,
			message: err.message
		})
	}
}

