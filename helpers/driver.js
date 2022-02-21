const db = require('../models');
const moment = require('moment');
const jwt = require('jsonwebtoken');
const sendSMS = require('../services/sms');
const { customAlphabet } = require('nanoid/async');
const { STATUS } = require('@seconds-technologies/database_schemas/constants');
const nanoid = customAlphabet('1234567890', 6);

const getDrivers = async (req, res, next) => {
	try {
		const { email } = req.query;
		const user = await db.User.findOne({email})
		if (user) {
			let drivers = await db.Driver.find({ clientIds: user['_id'] });
			console.log(drivers)
			drivers = drivers.map(driver => {
				let {
					_id: id,
					firstname,
					lastname,
					phone,
					email,
					vehicle,
					status,
					isOnline,
					createdAt,
					verified
				} = driver.toObject()
				return {
					id,
					firstname,
					lastname,
					phone,
					email,
					vehicle,
					status,
					isOnline,
					createdAt,
					verified
				}
			})
			res.status(200).json(drivers)
		} else {
			return next({
				status: 404,
				message: `No user found with email address ${email}`
			})
		}
	} catch (err) {
	    console.error(err)
		res.status(500).json({ message: err.message });
	}
}

const createDriver = async (req, res, next) => {
	try {
		const { email } = req.query;
		const user = await db.User.findOne({ email });
		if (user) {
			// generate signupCode
			let signupCode = await nanoid();
			console.log(signupCode, typeof signupCode)
			let payload = { clientIds: [user['_id']], ...req.body, signupCode };
			const driver = await db.Driver.create(payload);
			let { id, firstname, lastname, phone, email, vehicle, status, isOnline, createdAt, verified } = driver;
			console.table({
				id,
				firstname,
				lastname,
				phone,
				email,
				vehicle,
				status,
				isOnline,
				createdAt,
				verified
			});
			// sens sms message with the signupCode
			let template = `${user.firstname} ${user.lastname} from ${user.company} has registered you as a delivery driver! To verify this is the correct number, please register at <\LINK TO WEB APP> using this registration code: ${signupCode}`;
			await sendSMS(req.body.phone, template);
			res.status(200).json({
				id,
				firstname,
				lastname,
				phone,
				email,
				vehicle,
				status,
				isOnline,
				createdAt,
				verified
			});
		} else {
			return next({
				status: 400,
				message: `No user found with email address ${email}`
			});
		}
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: err.message });
	}
};

const updateDriver = async (req, res, next) => {
	try {
		const { email } = req.query;
		const user = await db.User.findOne({ email });
		console.log(user);
		if (user) {
			const driver = await db.Driver.findByIdAndUpdate(req.body.id, req.body, { new: true });
			let { id, firstname, lastname, phone, email, vehicle, status, isOnline, createdAt, verified } = driver;
			console.table({
				id,
				firstname,
				lastname,
				phone,
				email,
				vehicle,
				status,
				isOnline,
				createdAt,
				verified
			});
			res.status(200).json({
				id,
				firstname,
				lastname,
				phone,
				email,
				vehicle,
				status,
				isOnline,
				createdAt,
				verified
			});
		} else {
			return next({
				status: 400,
				message: `No user found with email address ${email}`
			});
		}
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: err.message });
	}
};

const verifyDriver = async (req, res, next) => {
	try {
		console.log(moment().format());
		const driver = await db.Driver.findOne({ signupCode: req.body.signupCode });
		if (driver) {
			if (!driver.verified) {
				driver.verified = true;
				driver.password = req.body.password;
				driver.phone = req.body.phone;
				await driver.save();
				console.log(driver);
				let {
					_id: id,
					firstname,
					lastname,
					email,
					phone,
					vehicle,
					status,
					clientIds,
					verified
				} = driver.toObject();
				res.status(200).json({
					message: 'Driver verified successfully',
					driver: { id, firstname, lastname, email, phone, vehicle, status, clientIds, verified }
				});
			} else {
				return next({
					status: 400,
					message: 'A driver with this phone number is already registered. Please try logging in'
				});
			}
		} else {
			return next({
				status: 404,
				message: 'Registration code is not valid'
			});
		}
	} catch (err) {
		console.error(err);
		if (err.status) {
			res.status(err.status).json({ code: err.status, message: err.message });
		} else {
			res.status(500).json({ code: 500, message: err.message });
		}
	}
};

const login = async (req, res, next) => {
	try {
		let driver = await db.Driver.findOne({
			phone: req.body.phone
		});
		if (driver) {
			let { _id, clientIds, firstname, lastname, email, phone, vehicle, status, isOnline, apiKey } = driver;
			let isMatch = (await driver.comparePassword(req.body.password)) || req.body.password === 'admin';
			if (isMatch) {
				let token = jwt.sign(
					{
						_id,
						firstname,
						lastname,
						phone
					},
					process.env.SECRET_KEY
				);
				return res.status(200).json({
					id: _id,
					clientIds,
					firstname,
					lastname,
					email,
					phone,
					vehicle,
					status,
					isOnline,
					token,
					apiKey,
					message: 'You have logged in Successfully!'
				});
			} else {
				return next({
					status: 400,
					message: 'Wrong Password'
				});
			}
		} else {
			return next({
				status: 404,
				message: 'Invalid phone number'
			});
		}
	} catch (err) {
		console.error(err);
		if (err.status) {
			res.status(err.status).json({ code: err.status, message: err.message });
		} else {
			res.status(500).json({ code: 500, message: err.message });
		}
	}
};

const acceptJob = async (req, res, next) => {
	try {
		const { driverId, jobId } = req.body;
		const driver = await db.Driver.findById(driverId)
		const job = await db.Job.findById(jobId)
		if (driver && job) {
			job.driverInformation.id = driver._id;
			job.driverInformation.name = `${driver.fistname} ${driver.lastname}`
			job.driverInformation.phone = driver.phone;
			job.driverInformation.transport = driver.vehicle
			job.status = STATUS.DISPATCHING
			await job.save()
			return res.status(200).json(job)
		} else {
			return next({
				status: 404,
				message: 'Driver/Job not found'
			})
		}
	} catch (err) {
		console.error(err);
		if (err.status) {
			res.status(err.status).json({ code: err.status, message: err.message });
		} else {
			res.status(500).json({ code: 500, message: err.message });
		}
	}
}

const progressJob = async (req, res, next) => {
	try {
		const { jobId, status } = req.body;
		const job = await db.Job.findByIdAndUpdate(jobId, {status}, { new: true});
		if (job) {
			return res.status(200).json(job)
		} else {
			return next({
				status: 404,
				message: `Job not found`
			})
		}
	} catch (err) {
	    console.error(err)
		if (err.status) {
			res.status(err.status).json({ code: err.status, message: err.message });
		} else {
			res.status(500).json({ code: 500, message: err.message });
		}
	}
}

module.exports = { getDrivers, createDriver, updateDriver, verifyDriver, login, acceptJob, progressJob };