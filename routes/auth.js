const express = require("express");
const router = express.Router();

const {
	register,
	login,
	sendPasswordResetEmail,
	newStripeCustomer,
	validateCredentials,
	resetPassword
} = require("../helpers/auth")

router.post("/register", register);
router.post("/login", login);
router.post('/validate', validateCredentials)
router.post('/stripe-customer', newStripeCustomer)
router.post("/send-reset-email", sendPasswordResetEmail);
router.patch("/reset-password", resetPassword);

module.exports = router;