require('dotenv').config();
const express = require('express');
const moment = require('moment-timezone');
moment.tz.setDefault('Europe/London');
const logger = require('morgan');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./models/index');
const errorHandler = require('./helpers/error');
const authRoutes = require('./routes/auth');
const mainRoutes = require('./routes/main');
const shopifyRoutes = require('./routes/shopify');
const paymentRoutes = require('./routes/payments');
const stripeRoutes = require('./routes/stripe');
const subscriptionRoutes = require('./routes/subscriptions');
const { authenticateUser } = require('./middleware/auth');

const app = express();
app.use(logger('dev'));

const PORT = process.env.PORT || 8081;

app.use(cors());

app.use(
	bodyParser.json({
		verify: function (req, res, buf) {
			let url = req['originalUrl'];
			if (url.startsWith('/server/stripe/webhook')) {
				req.rawBody = buf.toString();
			}
		},
	})
);

//STRIPE WEBHOOKS
app.use('/server/stripe', stripeRoutes);

app.use(bodyParser.urlencoded({ extended: true }));

app.get('/server', (req, res) => {
	res.status(200).json({
		message: 'Welcome to Shopify!',
	});
});
app.use('/uploads', express.static('uploads'));
app.use('/server/auth', authRoutes);
app.use('/server/main', authenticateUser, mainRoutes); //TODO - Correct path for redux thunks in client-end
app.use('/server/shopify', authenticateUser, shopifyRoutes);
app.use('/server/payment', authenticateUser, paymentRoutes);
app.use('/server/subscription', subscriptionRoutes);

//TODO - move middleware above server routes and test

//routes
app.use((req, res, next) => {
	let err = new Error('Not Found');
	err.status = 404;
	next(err);
});

app.use(errorHandler);

app.listen(PORT, () => {
	console.log(`Server is listening on port ${PORT}...`);
	console.log('Database:', process.env.MONGODB_URI);
	const SUBSCRIPTION_PLANS = process.env.STRIPE_SUBSCRIPTION_PLANS.split(' ')
	const COMMISSION_PLANS = process.env.STRIPE_COMMISSION_PLANS.split(' ')
	console.log(SUBSCRIPTION_PLANS)
	console.log(COMMISSION_PLANS)
});