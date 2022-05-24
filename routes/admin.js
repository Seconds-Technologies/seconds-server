const express = require("express");
const db = require('../models');
const { STATUS } = require('@seconds-technologies/database_schemas/constants');
const router = express.Router();

router.delete('/orders/remove-cancelled', async(req, res, next) => {
	try {
	    const { email } = req.query;
		const user = await db.User.findOne({ email });
		if (user) {
			await db.Job.deleteMany({clientId: user._id, status: STATUS.CANCELLED})
			res.status(200).json({message: "Jobs deleted successfully!"})
		} else {
			next({
				status: 404,
				message: "No user found with the email address " + email
			})
		}
	} catch (err) {
	    console.error(err)
		return next({
			status: err.status ? err.status : 500,
			message: err.message
		})
	}
});

module.exports = router;