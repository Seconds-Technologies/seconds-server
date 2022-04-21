require('dotenv').config();
const express = require('express');
const moment = require('moment-timezone');
moment.tz.setDefault('Europe/London');
const logger = require('morgan');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./models/index');
const timeout = require('connect-timeout')
//middleware
const { errorHandler } = require('./helpers/error');
const { authenticateUser } = require('./middleware/auth');
const { wooCommerceTimeout } = require('./middleware');
//routes
const authRoutes = require('./routes/auth');
const mainRoutes = require('./routes/main');
const shopifyRoutes = require('./routes/shopify');
const squareRoutes = require('./routes/square');
const woocommerceRoutes = require('./routes/woocommerce')
const squarespaceRoutes = require('./routes/squarespace')
const hubriseRoutes = require('./routes/hubrise')
const paymentRoutes = require('./routes/payments');
const stripeRoutes = require('./routes/stripe');
const subscriptionRoutes = require('./routes/subscriptions');
const driverRoutes = require('./routes/driver');
const settingsRoutes = require('./routes/settings');

const app = express();
app.use(logger('dev'));
app.use(timeout('5s', {
	respond: false,
}))

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
// CORE ROUTES
app.use('/uploads', express.static('uploads'));
app.use('/server/auth', authRoutes);
app.use('/server/main', authenticateUser, mainRoutes); //TODO - Correct path for redux thunks in client-end
app.use('/server/driver', driverRoutes);
app.use('/server/settings', authenticateUser, settingsRoutes);

// E-COMMERCE INTEGRATION ROUTES
app.use('/server/square', squareRoutes)
app.use('/server/shopify', authenticateUser, shopifyRoutes);
app.use('/server/woocommerce', wooCommerceTimeout, woocommerceRoutes)
app.use('/server/squarespace', squarespaceRoutes)
app.use('/server/hubrise', hubriseRoutes)

// PAYMENT & SUBSCRIPTION ROUTES
app.use('/server/payment', authenticateUser, paymentRoutes);
app.use('/server/subscription', authenticateUser, subscriptionRoutes);

//TODO - move middleware above server routes and test

//routes
app.use((req, res, next) => {
	let err = new Error('Endpoint Not Found');
	err.status = 404;
	next(err);
});

app.use(errorHandler);

app.listen(PORT, () => {
	console.log(`Server is listening on port ${PORT}...`);
	console.log('Database:', process.env.MONGODB_URI);
});