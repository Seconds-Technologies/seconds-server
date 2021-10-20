const express = require("express");
const router = express.Router();
const multer = require("multer");
const multerS3 = require("multer-s3");
const shorthash = require('shorthash');
const {S3} = require('../constants/index')

/*const storage = multer.diskStorage({
	destination: (req, file, callback) => {
		callback(null, './uploads/');
	},
	filename: (req, file, callback) => {
		callback(null, `${shorthash.unique(file.originalname)}.jpg`)
	}
})

const upload = multer({
	storage,
	fileFilter(req, file, callback) {
		file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' ? callback(null, true) : callback(null, false)
	}
})*/

const upload = (bucket) => multer({
	storage: multerS3({
		s3: S3,
		bucket,
		metadata: function (req, file, cb) {
			cb(null, {fieldName: file.fieldname})
		},
		key: function (req, file, cb) {
			cb(null, `${shorthash.unique(file.originalname)}.jpg`)
		}
	})
})

const {
	register,
	login,
	generateSecurityKeys,
	updateProfile,
	uploadProfileImage
} = require("../helpers/auth")

router.post("/register", register);
router.post("/login", login);
router.post("/token", generateSecurityKeys);
router.post("/update", updateProfile)
router.post("/upload", upload("seconds-profile-pictures").single('img'), uploadProfileImage)

module.exports = router;