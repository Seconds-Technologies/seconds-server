const mongoose = require('mongoose')

mongoose.set("debug", false);
mongoose.Promise = Promise;

mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/seconds", {
    keepAlive: true,
    useCreateIndex: true,
    useNewUrlParser: true,
    useFindAndModify: false,
    useUnifiedTopology: true
}, () => console.log("Connected to Mongo Database!"))

module.exports.User = require("./user");
module.exports.PostCode = require("./region");