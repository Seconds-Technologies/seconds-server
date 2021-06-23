require("dotenv").config();
const express = require("express");
const app = express();
const logger = require('morgan');
const cors = require("cors");
const bodyParser = require('body-parser');
const errorHandler = require('./helpers/error');
const authRoutes = require('./routes/auth');
const shopifyRoutes = require('./routes/shopify');
const { authorizeUser, authenticateUser } = require('./middleware/auth');
app.use(logger("dev"))

const db = require('./models/index');
const PORT = process.env.PORT || 8081;

app.use(cors())
app.use(bodyParser.json())

app.get('/api', (req, res) => {
    res.status(200).json({
        message: "Welcome to Shopify!"
    })
})
app.use('/uploads', express.static('uploads'));
app.use('/api/auth', authRoutes);
app.use('/api/shopify', shopifyRoutes);
app.use(
    authenticateUser,
    authorizeUser
);

/*app.get("/api/messages", authenticateUser, async function (req, res, next) {
    try {
        let messages = await db.Message.find()
            .sort({createdAt: "desc"})
            .populate("user", {
                username: true,
                profileImageURL: true
            });
        return res.status(200).json(messages)
    } catch (err) {
        console.error(err)
        return next(err)
    }
})*/

//routes
app.use((req, res, next) => {
    let err = new Error("Not Found");
    err.status = 404;
    next(err);
})

app.use(errorHandler)

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}...`)
});