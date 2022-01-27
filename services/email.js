const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmail = async options => {
	const msg = {
		from: 'Seconds Technologies <ola@useseconds.com>',
		to: `${options.name} <${options.email}>`,
		subject: options.subject,
		...(options.message && { text: options.message }),
		...(options.html && { html: options.html }),
		...(options.templateId && { templateId: options.templateId }),
		...(options.templateData && { dynamicTemplateData: options.templateData })
	};
	// 3) Actually send the email
	process.env.NODE_ENV === 'production' && await sgMail.send(msg);
};

module.exports = sendEmail;