const wooCommerceTimeout = (err, req, res, next) => {
	console.log("TIMEOUT", req.timedout)
	!req.timedout && next()
}

module.exports = { wooCommerceTimeout };