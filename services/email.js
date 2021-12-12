const nodemailer = require('nodemailer');
const nodemailerSendGrid = require('nodemailer-sendgrid');

const sendEmail = async options => {
	// 1) Create a transporter
	const transporter = nodemailer.createTransport(
		nodemailerSendGrid({
			apiKey: process.env.SENDGRID_API_KEY,
		})
		// Activate in gmail "less secure app" option
	);

	/*const transporterTest =  nodemailer.createTransport({
		host: process.env.EMAIL_HOST,
		port: process.env.EMAIL_PORT,
		auth: {
			user: process.env.MAILTRAP_SMTP_USERNAME,
			pass: process.env.MAILTRAP_SMTP_PASSWORD
		}
	})*/

	// 2) definer the email options
	const mailOptions = {
		from: 'Seconds Technologies <ola@useseconds.com>',
		to: `${options.full_name} <${options.email}>`,
		subject: options.subject,
		...(options.message && {text: options.message}),
		...(options.html && {html: options.html})
	};

	/*const mailOptionsTest = {
		from: 'Seconds Technologies <test@example.com>',
		to: `${options.full_name} <${options.email}>`,
		subject: options.subject,
		text: options.message
	}*/
	// 3) Actually send the email
	process.env.ENVIRONMENT_MODE === "live" && await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;