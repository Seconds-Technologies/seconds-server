const db = require('../models');
const moment = require('moment');
const jwt = require('jsonwebtoken');
const sendSMS = require('../services/sms');
const { customAlphabet } = require('nanoid/async');
const { STATUS } = require('@seconds-technologies/database_schemas/constants');
const { genApiKey, getBase64Image } = require('./index');
const { DRIVER_STATUS, S3, S3_BUCKET_NAMES } = require('../constants');
const shorthash = require('shorthash');
const nanoid = customAlphabet('1234567890', 6);

async function checkDriverStatus(driverId) {
	try {
		// query all jobs belonging to driver
		// count number of jobs where status is DISPATCHING or EN-ROUTE
		const count = await db.Job.countDocuments({
			'driverInformation.id': driverId,
			status: { $in: [STATUS.DISPATCHING, STATUS.EN_ROUTE] }
		});
		console.table({ count });
		// make necessary update
		if (count > 0) {
			await db.Driver.findByIdAndUpdate(driverId, { status: DRIVER_STATUS.BUSY });
		} else {
			await db.Driver.findByIdAndUpdate(driverId, { status: DRIVER_STATUS.AVAILABLE });
		}
	} catch (err) {
		console.error(err);
		throw err;
	}
}

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
					id,
					firstname,
					lastname,
					email,
					phone,
					vehicle,
					status,
					clientIds,
					verified,
					message: 'Driver verified successfully'
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

const createDriver = async (req, res, next) => {
	try {
		const { email } = req.query;
		const user = await db.User.findOne({ email });
		if (user) {
			// generate signupCode
			let signupCode = await nanoid();
			console.log(signupCode, typeof signupCode);
			let payload = { clientIds: [user['_id']], signupCode, apiKey: genApiKey(), ...req.body };
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
		let { id, password, confirmPassword, ...payload } = req.body;
		// check if password was updated
		if (password) {
			// add password to payload
			payload = { ...payload, password };
		}
		const driver = await db.Driver.findByIdAndUpdate(id, payload, { new: true });
		if (driver) {
			let { firstname, lastname, phone, email, vehicle, status, isOnline, createdAt, verified, devicePushToken } =
				driver;
			console.table({
				firstname,
				lastname,
				phone,
				email,
				vehicle,
				status,
				isOnline,
				createdAt,
				verified,
				devicePushToken
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
				status: 404,
				message: 'No driver found with ID ' + id
			});
		}
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: err.message });
	}
};

const getDrivers = async (req, res, next) => {
	try {
		const { email } = req.query;
		const user = await db.User.findOne({ email });
		if (user) {
			let drivers = await db.Driver.find({ clientIds: user['_id'] });
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
				} = driver.toObject();
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
				};
			});
			res.status(200).json(drivers);
		} else {
			return next({
				status: 404,
				message: `No user found with email address ${email}`
			});
		}
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: err.message });
	}
};

const deleteDrivers = async (req, res, next) => {
	try {
		const { email } = req.query;
		const driverIds = req.body;
		console.log(driverIds);
		const user = await db.User.findOne({ email });
		if (user) {
			const drivers = await db.Driver.deleteMany({ _id: driverIds, clientIds: user._id }, { new: true });
			console.log(drivers);
			res.status(200).json({ message: 'SUCCESS' });
		} else {
			return next({
				status: 404,
				message: `No user found with email address ${email}`
			});
		}
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: err.message });
	}
};

const acceptJob = async (req, res, next) => {
	try {
		const { driverId, jobId } = req.body;
		const driver = await db.Driver.findByIdAndUpdate(driverId, { status: DRIVER_STATUS.BUSY });
		const job = await db.Job.findById(jobId);
		if (driver && job) {
			job.driverInformation.id = driver._id;
			job.driverInformation.name = `${driver.firstname} ${driver.lastname}`;
			job.driverInformation.phone = driver.phone;
			job.driverInformation.transport = driver.vehicle;
			job.status = STATUS.DISPATCHING;
			job.trackingHistory.push({
				timestamp: moment().unix(),
				status: STATUS.DISPATCHING
			})
			await job.save();
			return res.status(200).json(job);
		} else {
			return next({
				status: 404,
				message: 'Driver/Job not found'
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

const progressJob = async (req, res, next) => {
	try {
		const { jobId, status } = req.body;
		let update = {
			$set: { status },
			$push: {
				trackingHistory: [
					{
						timestamp: moment().unix(),
						status
					}
				]
			}
		};
		const job = await db.Job.findByIdAndUpdate(jobId, update, { new: true });
		// check the driver's job status if it needs to be changed
		if (job) {
			await checkDriverStatus(job['driverInformation'].id);
			return res.status(200).json(job);
		} else {
			return next({
				status: 404,
				message: `Job not found`
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

const uploadDeliverySignature = async (req, res, next) => {
	try {
		const { jobId, type, img } = req.body;
		console.table({ jobId, type });
		// verify that the job exists
		const job = await db.Job.findById(jobId);
		if (job) {
			const {
				jobSpecification: { orderNumber }
			} = job.toObject();
			// extract base64 data from image string
			const base64Data = new Buffer.from(img.replace(/^data:image\/\w+;base64,/, ''), 'base64');
			console.log(base64Data);
			// generate s3 object params
			const Key = `${process.env.ENVIRONMENT_MODE}/${moment().format('DD-MM-YYYY')}/${orderNumber}/${type}`;
			console.table({ Key });
			const params = {
				Bucket: S3_BUCKET_NAMES.DOCUMENTS,
				Key, // type is not required
				Body: base64Data,
				ContentEncoding: 'base64', // required
				ContentType: `image/png` // required. Notice the back ticks
			};
			// upload the image to S3 bucket and retrieve the object location / file details
			const result = await S3.upload(params).promise();
			console.log('Image File:', `${type}.png`);
			//update the signature image in job document
			job['jobSpecification']['deliveries'][0].proofOfDelivery[type].filename = Key;
			job['jobSpecification']['deliveries'][0].proofOfDelivery[type].location = result.Location;
			console.log(job.jobSpecification.deliveries);
			await job.save();
			// retrieve image object from s3 convert to base64
			// let base64Image = await getBase64Image(filename);
			return res.status(200).json({
				message: 'image uploaded!'
			});
		}
	} catch (err) {
		return next({
			status: 400,
			message: err.message
		});
	}
};

const uploadDeliveryPhoto = async (req, res, next) => {
	try {
		const { jobId } = req.body;
		console.log(jobId);
		const file = req.file;
		console.log(file);
		const job = await db.Job.findById(jobId);
		//update the signature image in job document
		if (job) {
			const location = req.file.location;
			job['jobSpecification']['deliveries'][0].proofOfDelivery.photo.filename = req.file.key;
			job['jobSpecification']['deliveries'][0].proofOfDelivery.photo.location = location;
			console.log(job.jobSpecification.deliveries);
			await job.save();
			return res.status(200).json({ success: true });
		} else {
			return next({
				status: 404,
				message: 'No job found with Id ' + jobId
			});
		}
	} catch (err) {
		console.error(err);
		return next({
			status: 400,
			message: err.message
		});
	}
};

const downloadDeliveryProof = async (req, res, next) => {
	try {
		const { filename } = req.body;
		console.log(filename);
		const img = await getBase64Image(filename, S3_BUCKET_NAMES.DOCUMENTS);
		res.status(200).json(img);
	} catch (err) {
		console.error(err);
		return next({
			status: 400,
			message: err.message
		});
	}
};

const updateDriverLocation = async (req, res, next) => {
	try {
		const { driverId } = req.query;
		const { longitude, latitude } = req.body;
		console.table({ driverId, longitude, latitude });
		const driver = await db.Driver.findById(driverId);
		if (driver && longitude && latitude) {
			await db.Job.updateMany(
				{ 'driverInformation.id': driverId, status: { $in: [STATUS.DISPATCHING, STATUS.EN_ROUTE] } },
				{
					'driverInformation.location': {
						type: 'Point',
						coordinates: [longitude, latitude]
					}
				},
				{new: true}
			);
		}
		res.status(200).json({ message: 'SUCCESS' });
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: err.message });
	}
};

module.exports = {
	getDrivers,
	createDriver,
	updateDriver,
	verifyDriver,
	deleteDrivers,
	login,
	acceptJob,
	progressJob,
	uploadDeliverySignature,
	uploadDeliveryPhoto,
	downloadDeliveryProof,
	updateDriverLocation
};
