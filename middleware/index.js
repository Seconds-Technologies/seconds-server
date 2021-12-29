const wooCommerceTimeout = (err, req, res, next) => {
	console.log("TIMEOUT", req.timedout)
	!req.timedout ? next() : res.redirect(303, `${process.env.CLIENT_HOST}/integrate/woocommerce?success=0&error=${err.message}`);
}

module.exports = { wooCommerceTimeout };