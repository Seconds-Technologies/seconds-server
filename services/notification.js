const MagicBellClient = require("@magicbell/core").default;
const { Notification } = require('@magicbell/core');

MagicBellClient.configure({ apiKey: process.env.MAGIC_BELL_API_KEY, apiSecret: process.env.MAGIC_BELL_SECRET_KEY });

const sendNotification = async (external_id, title, content, category) => {
	const notification = await Notification.create({
		category,
		title,
		content,
		recipients: [{ external_id }]
	});
	console.log(notification);
};

module.exports = sendNotification;