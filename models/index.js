const mongoose = require('mongoose')
const { catalogSchema, userSchema, jobSchema, driverSchema, settingsSchema } = require('@seconds-technologies/database_schemas')

mongoose.set("debug", false);
mongoose.Promise = Promise;

mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/seconds", {
    keepAlive: true,
}, () => console.log("Connected to Mongo Database!"))

module.exports.User = mongoose.model('User', userSchema);
module.exports.PostCode = mongoose.model("Postcode", require("./region"));
module.exports.Job = mongoose.model('Job', jobSchema)
module.exports.Driver = mongoose.model("Driver", driverSchema);
module.exports.Catalog = mongoose.model('Catalog', catalogSchema);
module.exports.Settings = mongoose.model('Settings', settingsSchema);