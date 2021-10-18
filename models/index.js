const mongoose = require('mongoose')
const Grid = require('gridfs-stream')
Grid.mongo = mongoose.mongo

mongoose.set("debug", false);
mongoose.Promise = Promise;

mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/seconds", {
    keepAlive: true,
    useCreateIndex: true,
    useNewUrlParser: true,
    useFindAndModify: false,
    useUnifiedTopology: true
}, () => console.log("Connected to Mongo Database!"))

let gfs;
const conn = mongoose.connection;

conn.once('open', () => {
    //Initialise the stream
    console.log("opening connection...")
    gfs = Grid(conn.db)
    gfs.collection('uploads')
})

module.exports.User = mongoose.model('User', require("./user"));
module.exports.PostCode = mongoose.model("Postcode", require("./region"));