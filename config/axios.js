const axios = require('axios');

exports.magicBellAxios = axios.create({
	headers: {
		'X-MAGICBELL-API-KEY': process.env.MAGIC_BELL_API_KEY,
		'X-MAGICBELL-API-SECRET': process.env.MAGIC_BELL_SECRET_KEY
	}
})