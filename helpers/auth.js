const axios = require('axios');
const kanaAdmin = require('../services/kana');
const PNF = require('google-libphonenumber').PhoneNumberFormat;
const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();

async function newMagicBellUser(mongoId, email, phone, firstname, lastname, company, fullAddress = '') {
	try {
		const config = {
			headers: {
				'X-MAGICBELL-API-KEY': process.env.MAGIC_BELL_API_KEY,
				'X-MAGICBELL-API-SECRET': process.env.MAGIC_BELL_SECRET_KEY
			}
		};
		// parse phone number to E164 format
		const number = phoneUtil.parseAndKeepRawInput(phone, 'GB');
		const E164Number = phoneUtil.format(number, PNF.E164);
		const payload = {
			user: {
				external_id: mongoId,
				email,
				first_name: firstname,
				last_name: lastname,
				phone_numbers: [E164Number],
				custom_attributes: {
					company,
					fullAddress
				}
			}
		};
		const response = (await axios.post(`${process.env.MAGIC_BELL_HOST}/users`, payload, config)).data;
		console.log(response);
		return response.user.id;
	} catch (err) {
		console.error(err);
		throw err;
	}
}

async function newKanaUser(mongoId, email, firstname, lastname, stripeCustomerId) {
	try {
		let kanaUser = await kanaAdmin.users.create({
			input: {
				id: email,
				email,
				name: `${firstname} ${lastname}`,
				billingId: stripeCustomerId
			}
		});
		if (kanaUser.data) {
			console.log(kanaUser.data);
			const kanaCredentials = await kanaAdmin.users.generateToken({
				userId: email
			});
			if (kanaCredentials.data) {
				console.log(kanaCredentials.data)
				return kanaCredentials.data
			} else {
				throw kanaCredentials.error
			}
		} else {
			throw kanaUser.error
		}
	} catch (err) {
		console.error(err);
		throw err
	}
}

module.exports = { newMagicBellUser, newKanaUser }