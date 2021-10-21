const express = require("express");
const router = express.Router();

const {
	register,
	login,
	sendPasswordResetEmail,
	resetPassword
} = require("../helpers/auth")

router.post("/register", register);
router.post("/login", login);
router.post("/send-reset-email", sendPasswordResetEmail);
router.patch("/reset-password", resetPassword);

module.exports = router;