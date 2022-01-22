class ErrorHandler extends Error {
    constructor(statusCode, message) {
        super();
        this.status = statusCode;
        this.message = message;
    }
}

errorHandler = (error, req, res, next) => {
    return res.status(error.status || 500).json({
        error: {
            message: error.message || "Something went wrong."
        }
    })
}

module.exports = { errorHandler, ErrorHandler };