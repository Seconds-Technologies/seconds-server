const multer = require("multer");
const {GridFsStorage} = require('multer-gridfs-storage');
const util = require("util");
const shorthash = require("shorthash");
const db = require('../models/index');

const storage = new GridFsStorage({
	db,
	file: (req, file) => {
		console.log("Request", req)
		console.log("File", file)
		const match = ["image/png", "image/jpeg"];
		if (match.indexOf(file.mimetype) === -1) {
			return shorthash.unique(`${Date.now()}-any-name-${file.originalname}`);
		}
		return {
			bucketName: "uploads",
			filename: shorthash.unique(`${Date.now()}-any-name-${file.originalname}`),
		};
	},
});

const checkStorage = async () => {
	try {
		const {db, client} = await storage.ready();
		console.log(db)
		console.log(client)
		// db is the database instance
		// client is the MongoClient instance
	} catch (err) {
		// err is the error received from MongoDb
		console.log(err)
	}
}

const uploadFile = multer({storage: storage}).single("file");
const uploadFilesMiddleware = util.promisify(uploadFile)

module.exports = {checkStorage, uploadFilesMiddleware};