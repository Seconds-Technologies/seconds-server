const express = require("express");
const router = express.Router();
const multer = require("multer")
const shorthash = require('shorthash')

const storage = multer.diskStorage({
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
router.post("/upload", upload.single('img'), uploadProfileImage)

module.exports = router;