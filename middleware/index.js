const wooCommerceTimeout = (req, res, next) => {
	console.log(req.timedout)
	!req.timedout && next()
}

module.exports = { wooCommerceTimeout };