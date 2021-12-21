const mongoose = require('mongoose')

mongoose.set("debug", false);
mongoose.Promise = Promise;

mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/seconds", {
    keepAlive: true,
}, () => console.log("Connected to Mongo Database!"))

module.exports.User = mongoose.model('User', require("./user"));
module.exports.PostCode = mongoose.model("Postcode", require("./region"));