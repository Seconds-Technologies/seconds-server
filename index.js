require("dotenv").config();
const express = require("express");
const moment = require('moment-timezone');
moment.tz.setDefault("Europe/London");
const logger = require('morgan');
const cors = require("cors");
const bodyParser = require('body-parser');
const db = require('./models/index');
const errorHandler = require('./helpers/error');
const authRoutes = require('./routes/auth');
const shopifyRoutes = require('./routes/shopify');
const jobRoutes = require('./routes/jobs');
const { authorizeUser, authenticateUser } = require('./middleware/auth');

const app = express();
app.use(logger("dev"))

const PORT = process.env.PORT || 8081;

app.use(cors())
app.use(bodyParser.json())

app.get('/server', (req, res) => {
    res.status(200).json({
        message: "Welcome to Shopify!"
    })
})
app.use('/uploads', express.static('uploads'));
app.use('/server/auth', authRoutes);
app.use('/server/shopify', shopifyRoutes);
app.use('/server/jobs', jobRoutes);
app.use(
    authenticateUser,
    authorizeUser
);

//routes
app.use((req, res, next) => {
    let err = new Error("Not Found");
    err.status = 404;
    next(err);
})

app.use(errorHandler)

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}...`)
    console.log("production DB:", process.env.MONGODB_URI)
});