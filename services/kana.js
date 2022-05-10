const kana = require('@usekana/admin-kana-js');

const kanaAdmin = new kana.KanaAdmin({
	apiKey: process.env.KANA_API_KEY
})

module.exports = kanaAdmin;