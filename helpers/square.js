const getCredentials = async (req, res) => {
	try {
		console.log(req.body);
		res.status(200).json(req.body);
	} catch (err) {
		console.error(err);
		res.status(400).json({ message: err.message });
	}
};

const validateSquare = async (req, res) => {
	try {
		console.log(req.body);
		res.status(200).json(req.body);
	} catch (err) {
		console.error(err);
		res.status(400).json({ message: err.message });
	}
};

module.exports = { validateSquare, getCredentials };