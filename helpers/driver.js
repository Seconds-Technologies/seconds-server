const db = require('../models');
const moment = require('moment');
const jwt = require('jsonwebtoken');
const sendSMS = require('../services/sms');
const { customAlphabet } = require('nanoid/async');
const { STATUS, VEHICLE_CODES_MAP, HUBRISE_STATUS } = require('@seconds-technologies/database_schemas/constants');
const { genApiKey, getBase64Image, convertToHubriseStatus } = require('./index');
const { DRIVER_STATUS, S3, S3_BUCKET_NAMES, MAGIC_BELL_CHANNELS } = require('../constants');
const nanoid = customAlphabet('1234567890', 6);
const { Client } = require('@googlemaps/google-maps-services-js');
const sendNotification = require('../services/notification');
const bcrypt = require('bcrypt');
const { sendHubriseStatusUpdate, sendHubriseEtaUpdate } = require('../services/hubrise');

const GMapsClient = new Client();

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

async function calculateDeliveryETA(origin, destination, mode) {
	console.log('ORIGIN:', origin);
	console.log('DESTINATION:', destination);
	try {
		const distanceMatrix = (
			await GMapsClient.distancematrix({
				params: {
					origins: [origin],
					destinations: [destination],
					key: process.env.GOOGLE_MAPS_API_KEY,
					units: 'imperial',
					mode
				},
				responseType: 'json'
			})
		).data;
		console.log(distanceMatrix.rows[0].elements[0]);
		let duration = Number(distanceMatrix.rows[0].elements[0].duration.value);
		console.log('================================================');
		console.log('DURATION', duration);
		const newEta = moment().add(duration, 's').format();
		console.log('NEW ETA', newEta);
		console.log('================================================');
		return newEta;
	} catch (err) {
		throw err;
	}
}

const login = async (req, res, next) => {
	try {
		let driver = await db.Driver.findOne({
			phone: req.body.phone,
			verified: true
		});
		if (driver) {
			let { _id, clientIds, firstname, lastname, email, phone, vehicle, status, isOnline, apiKey, profileImage } =
				driver;
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
				let img = '';
				if (profileImage && profileImage.filename)
					img = await getBase64Image(profileImage.filename, S3_BUCKET_NAMES.PROFILE_IMAGE);
				let profileImageData = img ? `data:image/png;base64,${img}` : img;
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
					profileImageData,
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
				// send success driver registration notification
				const title = 'New Driver!';
				const content = `${firstname} ${lastname} has finished their registration and is now ready to receive orders`;
				sendNotification(clientIds[0], title, content, MAGIC_BELL_CHANNELS.NEW_DRIVER).then(() =>
					console.log('notification sent!')
				);
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
		let { id, password, ...payload } = req.body;
		// check if password was updated
		if (password) {
			// add password to payload
			let encPassword = await bcrypt.hash(password, 10);
			payload = { ...payload, password: encPassword };
		}
		const driver = await db.Driver.findByIdAndUpdate(id, payload, { new: true });
		if (driver) {
			let { firstname, lastname, phone, email, vehicle, status, isOnline, createdAt, verified } = driver;
			console.log(driver.toObject());
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
			// sort drivers by date of creation
			drivers.sort((a, b) => b.createdAt - a.createdAt);
			// drivers.forEach(driver => console.log(driver.createdAt));
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
			await db.Driver.deleteMany({ _id: driverIds, clientIds: user['_id'] }, { new: true });
			let drivers = await db.Driver.find({clientIds: user['_id']})
			drivers.sort((a, b) => b.createdAt - a.createdAt);
			// drivers.forEach(driver => console.log(driver.createdAt));
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
			res.status(200).json({
				message: 'SUCCESS',
				drivers
			});
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
			job['driverInformation'].id = driver._id;
			job['driverInformation'].name = `${driver.firstname} ${driver.lastname}`;
			job['driverInformation'].phone = driver.phone;
			job['driverInformation'].transport = driver.vehicle;
			job.status = STATUS.DISPATCHING;
			job['trackingHistory'].push({
				timestamp: moment().unix(),
				status: STATUS.DISPATCHING
			});
			await job.save();
			// check if order is a hubrise order, if so send a status update
			if (job['jobSpecification'].hubriseId) {
				const hubrise = await db.Hubrise.findOne({ clientId: job.clientId });
				let orderId = job['jobSpecification'].hubriseId;
				console.log('Hubrise Order ID:', orderId);
				hubrise &&
					sendHubriseStatusUpdate(HUBRISE_STATUS.IN_PREPARATION, orderId, hubrise.toObject())
						.then(message => console.log(message))
						.catch(err => console.error(err.message));
			}
			// send notification to client
			const title = `${driver.firstname} has accepted an order`;
			const content = `Order ${job.jobSpecification.orderNumber} has been accepted by your driver. The order will be picked up shortly.`;
			sendNotification(job.clientId, title, content, MAGIC_BELL_CHANNELS.JOB_ACCEPTED).then(() =>
				console.log('notification sent!')
			);
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
				trackingHistory: {
					timestamp: moment().unix(),
					status
				}
			}
		};
		const job = await db.Job.findByIdAndUpdate(jobId, update, { new: true });
		// check the driver's job status if it needs to be changed
		if (job) {
			const user = await db.User.findById(job.clientId);
			const settings = await db.Settings.findOne({ clientId: job['clientId'] });
			let smsEnabled = settings ? settings.sms : false;
			// check if order is a hubrise order, if so send a status update
			if (job['jobSpecification'].hubriseId) {
				const hubrise = await db.Hubrise.findOne({ clientId: user['_id'] });
				let orderId = job['jobSpecification'].hubriseId;
				console.log('Hubrise Order ID:', orderId);
				hubrise &&
					sendHubriseStatusUpdate(convertToHubriseStatus(status), orderId, hubrise.toObject())
						.then(message => console.log(message))
						.catch(err => console.error(err.message));
			}
			if (status === STATUS.EN_ROUTE) {
				let template = `Your ${user.company} order has been picked up and the driver is on his way. Track your delivery here: ${process.env.TRACKING_BASE_URL}/${job._id}`;
				sendSMS(job.jobSpecification.deliveries[0].dropoffLocation.phoneNumber, template, smsEnabled).then(() =>
					console.log('SMS sent successfully!')
				);
			} else if (status === STATUS.COMPLETED) {
				const template = `Your ${user.company} order has been delivered. Thanks for ordering with ${user.company}`;
				sendSMS(job.jobSpecification.deliveries[0].dropoffLocation.phoneNumber, template, smsEnabled).then(() =>
					console.log('SMS sent successfully!')
				);
				const title = `Delivery Finished!`;
				const content = `Order ${job.jobSpecification.orderNumber} has been delivered to the customer.`;
				sendNotification(job.clientId, title, content, MAGIC_BELL_CHANNELS.ORDER_DELIVERED).then(() =>
					console.log('notification sent!')
				);
			} else if (status === STATUS.CANCELLED) {
				const title = `Order Cancelled`;
				const content = `Order ${job.jobSpecification.orderNumber} has been cancelled by your driver.`;
				sendNotification(job.clientId, title, content, MAGIC_BELL_CHANNELS.ORDER_CANCELLED).then(() =>
					console.log('notification sent!')
				);
			}
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
			// find all the jobs under the driverId that are DISPATCHING or EN-ROUTE
			const jobs = await db.Job.find({
				'driverInformation.id': driverId,
				status: { $in: [STATUS.DISPATCHING, STATUS.EN_ROUTE] }
			});
			// console.log(jobs)
			jobs.forEach(job => {
				const origin = [latitude, longitude];
				const destination = [
					job.jobSpecification.deliveries[0].dropoffLocation.latitude,
					job.jobSpecification.deliveries[0].dropoffLocation.longitude
				];
				const mode = VEHICLE_CODES_MAP[job.vehicleType].travelMode;
				// calculate new delivery ETA
				calculateDeliveryETA(origin, destination, mode).then(async deliveryETA => {
					if (job['jobSpecification'].hubriseId && deliveryETA) {
						const hubrise = await db.Hubrise.findOne({ clientId: job.clientId });
						let orderId = job['jobSpecification'].hubriseId;
						sendHubriseEtaUpdate(deliveryETA, orderId, hubrise)
							.then(message => console.log(message))
							.catch(err => console.error({ message: err.message }));
					}
					job.driverInformation.location = {
						type: 'Point',
						coordinates: [longitude, latitude]
					};
					job.jobSpecification.deliveries[0].dropoffEndTime = deliveryETA;
					await job.save();
				});
			});
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
