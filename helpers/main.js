const db = require('../models/index');
const crypto = require('crypto');
const axios = require('axios');
const shorthash = require('shorthash');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getBase64Image } = require('../helpers');
const moment = require('moment');
const { S3_BUCKET_NAMES, ROUTE_OPTIMIZATION_OBJECTIVES } = require('../constants');
const { VEHICLE_CODES } = require('@seconds-technologies/database_schemas/constants');
const { checkGeolocationProximity, countVehicles } = require('./index');
const optimizationAxios = axios.create();
optimizationAxios.defaults.headers.common['x-api-key'] = process.env.LOGISTICSOS_API_KEY;

const generateSecurityKeys = async (req, res, next) => {
	// generate the apiKey using random byte sequences
	try {
		const { email } = req.body;
		const rand = crypto.randomBytes(24);
		let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.repeat(2);
		let apiKey = '';

		for (let i = 0; i < rand.length; i++) {
			let index = rand[i] % chars.length;
			apiKey += chars[index];
		}
		console.log('Generated API Key', apiKey);
		// update the user's details with the new api key and their strategy
		await db.User.findOneAndUpdate({ email }, { apiKey: apiKey }, { new: true });
		// return the new apiKey
		return res.status(201).json({
			apiKey
		});
	} catch (err) {
		return next({
			status: 400,
			message: err.message
		});
	}
};

const updateProfile = async (req, res, next) => {
	try {
		const { id, data } = req.body;
		// update user info in database
		const { firstname, lastname, email, company, stripeCustomerId, phone, fullAddress } =
			await db.User.findByIdAndUpdate(id, { ...data }, { new: true });
		console.log('Stripe Customer', stripeCustomerId);
		// update stripe info
		await stripe.customers.update(stripeCustomerId, {
			email,
			name: `${firstname} ${lastname}`,
			phone,
			description: company
		});
		// update magic bell info
		const config = {
			headers : {
				'X-MAGICBELL-API-KEY': process.env.MAGIC_BELL_API_KEY,
				'X-MAGICBELL-API-SECRET': process.env.MAGIC_BELL_SECRET_KEY,
			}
		}
		const payload = {
			user: {
				email,
				first_name: firstname,
				last_name: lastname,
				phone_numbers: [
					phone
				],
				custom_attributes: {
					company,
					fullAddress
				}
			}
		}
		axios.put(`${process.env.MAGIC_BELL_HOST}/users/${id}`, payload, config).then((user) => console.log(user)).catch((err) => console.error(err))
		return res.status(200).json({
			firstname,
			lastname,
			email,
			company,
			phone,
			fullAddress,
			message: 'Profile updated successfully!'
		});
	} catch (err) {
		if (err.code === 11000) {
			err.message = 'Sorry, that email is taken!';
		}
		console.error(err);
		return next({
			status: 400,
			message: err.message
		});
	}
};

const uploadProfileImage = async (req, res, next) => {
	try {
		const { id } = req.body;
		const file = req.file;
		console.log(file);
		const location = req.file.location;
		const filename = `${shorthash.unique(file.originalname)}.jpg`;
		console.log('Image File:', filename);
		//update the profile image in user db
		const { profileImage } = await db.User.findByIdAndUpdate(
			id,
			{
				'profileImage.filename': filename,
				'profileImage.location': location
			},
			{ new: true }
		);
		console.log(profileImage);
		// retrieve image object from s3 convert to base64
		let base64Image = await getBase64Image(filename, S3_BUCKET_NAMES.PROFILE_IMAGE);
		return res.status(200).json({
			base64Image,
			message: 'image uploaded!'
		});
	} catch (err) {
		return next({
			status: 400,
			message: err.message
		});
	}
};

const updateDeliveryHours = async (req, res, next) => {
	try {
		const { email } = req.query;
		console.table(req.body);
		const user = await db.User.findOneAndUpdate({ email }, { deliveryHours: req.body }, { new: true });
		if (user) {
			console.log('Updated delivery hours');
			return res.status(200).json({
				updatedHours: user.deliveryHours,
				message: 'delivery hours updated'
			});
		} else {
			return next({
				status: 400,
				message: 'No delivery hours detected!'
			});
		}
	} catch (e) {
		res.status(400).json({
			message: e.message
		});
	}
};

const updateDeliveryStrategies = async (req, res, next) => {
	try {
		const { email } = req.query;
		console.table(req.body);
		const user = await db.User.findOneAndUpdate({ email }, { deliveryStrategies: req.body }, { new: true });
		if (user) {
			return res.status(200).json({
				deliveryStrategies: user.deliveryStrategies,
				message: 'delivery strategies updated'
			});
		}
	} catch (e) {
		console.error(e);
		res.status(400).json({
			message: e.message
		});
	}
};

const synchronizeUserInfo = async (req, res, next) => {
	try {
		const { email: EMAIL } = req.query;
		let user = await db.User.findOne({ email: EMAIL });
		if (user) {
			let {
				_id,
				firstname,
				lastname,
				email,
				phone,
				fullAddress,
				address,
				company,
				createdAt,
				apiKey,
				selectionStrategy,
				deliveryHours,
				paymentMethodId,
				stripeCustomerId,
				subscriptionId,
				subscriptionPlan
			} = user;
			// lookup integrated drivers
			let drivers = await db.Driver.find({ clientIds: _id });
			drivers.sort((a, b) => b.createdAt - a.createdAt);
			const settings = await db.Settings.findOne({clientId: _id})
			res.status(200).json({
				id: _id,
				firstname,
				lastname,
				email,
				company,
				createdAt,
				phone,
				fullAddress,
				address,
				deliveryHours,
				apiKey,
				selectionStrategy,
				stripeCustomerId,
				paymentMethodId,
				subscriptionId,
				subscriptionPlan,
				settings,
				drivers: drivers.map(driver => {
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
				}),
				message: 'User info synchronized successfully'
			});
		} else {
			return next({
				status: 404,
				message: `No user found with the specified email ${email}`
			});
		}
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: err.message });
	}
};

/**
 * Optimize Orders - returns a list of optimized routes for multiple drivers/vehicles
 * @constructor
 * @param req - request object
 * @param res - response object
 * @returns {Promise<*>}
 */
const sendRouteOptimization = async (req, res) => {
	try {
		const { email } = req.query;
		const user = await db.User.findOne({ email });
		console.log('USER found', !!user);
		const { orderNumbers, params } = req.body;
		if (user) {
			// retrieve the full order documents from db using orderNumbers
			const orders = await db.Job.find({ 'jobSpecification.orderNumber': { $in: orderNumbers } });
			console.log('******************************************');
			console.table({ orderCount: orders.length, ...params });
			console.log('******************************************');
			// iterate through each order and re-structure the payload to match logisticsOS "order" payload
			const ordersPayload = Array.from(orders).flatMap(
				({ jobSpecification: { orderNumber, deliveries } }) =>
					deliveries.flatMap(({ dropoffLocation, dropoffStartTime, dropoffEndTime }) => {
						return {
							id: orderNumber,
							geometry: {
								zipcode: dropoffLocation.postcode,
								coordinates: {
									lon: dropoffLocation.longitude,
									lat: dropoffLocation.latitude
								},
								curb: false
							},
							service: {
								dropoff_quantities: [1]
							},
							time_window: {
								start: dropoffStartTime ? moment(dropoffStartTime).unix() : moment().unix(),
								end: moment(dropoffEndTime).unix()
							}
						};
					})
			);
			// log final result to confirm
			console.log('-----------------------------------------------');
			console.log(ordersPayload);
			console.log('-----------------------------------------------');
			// check pickup address is the same across all deliveries
			let depotCoords = user['address'].geolocation.coordinates;
			let depotPostcode = user['address'].postcode;
			let startDepot = Array.from(orders).every(({ jobSpecification: { pickupLocation } }) => {
				console.log([pickupLocation.longitude, pickupLocation.latitude]);
				let postcodeMatch = pickupLocation.postcode === depotPostcode;
				// compares the equality of both the pickup coords and the depot coords to 2 decimal places
				let geolocationMatch = checkGeolocationProximity(depotCoords, [
					pickupLocation.longitude,
					pickupLocation.latitude
				]);
				return postcodeMatch && geolocationMatch;
			});
			let start_depots = startDepot
				? [
						{
							id: user.company,
							geometry: {
								zipcode: user.address.postcode,
								coordinates: {
									lon: user.address.geolocation.coordinates[0],
									lat: user.address.geolocation.coordinates[1]
								},
								curb: false
							},
							service_duration: 0,
							time_window: {
								start: moment(params.startFrom).unix(),
								end: moment(params.endFrom).unix()
							}
						}
				  ]
				: [];
			let breaks =
				moment(params.breakPeriod.start).isValid() && moment(params.breakPeriod.end).isValid()
					? [
							{
								id: params.breakPeriod.label,
								time_window: {
									start: moment(params.breakPeriod.start).unix(),
									end: moment(params.breakPeriod.end).unix()
								},
								duration: params.breakPeriod.duration
							}
					  ]
					: [];
			let objectives = Object.entries(params.objectives)
				.filter(([_, value]) => value)
				.map(([key, _]) => ROUTE_OPTIMIZATION_OBJECTIVES[key]);
			const drivers = await db.Driver.find({ vehicle: { $in: params.vehicles }, verified: true });
			console.log(drivers)
			// count drivers per vehicle
			let counts = countVehicles(drivers);
			console.table({ counts });
			const vehicle_types = [];
			counts.forEach((count, index) => {
				if (count) {
					vehicle_types.push({
						id: `${VEHICLE_CODES[index]}`,
						count,
						max_late_time: 0,
						max_orders_per_route: 10,
						avoid_wait_time: false,
						use_all_vehicles: true,
						depots: {
							start_depot: 'any'
						},
						...(params.breakPeriod.label && { break_ids: [params.breakPeriod.label] })
					});
				}
			});
			const optRequest = {
				start_depots,
				orders: ordersPayload,
				breaks,
				objectives,
				vehicle_types,
				units: {
					distance: 'kilometer',
					duration: 'minute'
				}
			};
			console.log(optRequest);
			let URL = `${process.env.LOGISTICSOS_BASE_URL}/vrp`;
			let config = { headers: { 'x-api-key': process.env.LOGISTICSOS_API_KEY } };
			const response = (await optimizationAxios.post(URL, optRequest, config)).data;
			console.log('************************************************');
			console.log(response);
			console.log('************************************************');
			res.status(200).json({ message: 'SUCCESS', ...response });
		}
	} catch (err) {
		console.error(err);
		if (err.message) {
			return res.status(err.status).json({
				error: err
			});
		}
		return res.status(500).json({
			error: {
				code: 500,
				message: 'Unknown error occurred!'
			}
		});
	}
};

const getOptimizedRoute = async (req, res, next) => {
	try {
		const { job_id, num_orders } = req.query;
		const URL = `${process.env.LOGISTICSOS_BASE_URL}/vrp`;
		const config = { headers: { 'x-api-key': process.env.LOGISTICSOS_API_KEY }, params: { job_id } };
		console.log(config);
		let result;
		do {
			result = (await new Promise(resolve => setTimeout(() => resolve(axios.get(URL, config)), 5000))).data;
			console.table({status: result.status});
		} while (result.status !== 'SUCCEED' && result.status !== 'FAILED');
		/***********************************************************************************************/
		if (result.status === 'FAILED') {
			console.log(result);
			return next({
				status: 400,
				message: 'Route optimization failed',
			});
		} else if (result['plan_summary'].unassigned === num_orders) {
			return next({
				status: 400,
				message: 'Your orders could not be optimized. Please check that your time windows are not in the past'
			});
		} else {
			result.routes.forEach(route => console.log(route))
			// all orders were assigned;
			console.log(result['unassigned_stops'].unreachable)
			return res.status(200).json({ message: 'SUCCESS', routes: result.routes, unreachable: result['unassigned_stops'].unreachable });
		}
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: err.message });
	}
};

const deleteOrders = async (req, res, next) => {
	try {
		const { email } = req.query;
		const { orderNumbers } = req.body;
		const user = await db.User.findOne({email})
		if (user) {
			const result = await db.Job.deleteMany({
				clientId: user._id,
				'jobSpecification.orderNumber': { $in: orderNumbers }
			}, {returnOriginal: true})
			console.log(result)
			res.status(200).json({message: "SUCCESS"})
		} else {
			return next({
				status: 404,
				message: "No user found with that email address"
			})
		}
	} catch (err) {
	    console.error(err)
		return next({
			status: 500,
			message: err.message
		})
	}
}

module.exports = {
	generateSecurityKeys,
	updateProfile,
	updateDeliveryHours,
	uploadProfileImage,
	updateDeliveryStrategies,
	synchronizeUserInfo,
	sendRouteOptimization,
	getOptimizedRoute,
	deleteOrders
};
