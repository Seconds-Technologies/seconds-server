require('dotenv').config();
const jwt = require('jsonwebtoken');
const express = require("express");

const authenticateAdmin = async (req, res, next) => {
    try {
        console.log(req.headers)
        const token = req.headers.authorization
        return token === process.env.ADMIN_ACCESS_KEY ? next() : next({
            status: 401,
            message: "You are not authorized to access this endpoint"
        })
    } catch (err) {
        console.error(err);
        return next({
            status: 401,
            message: "Please send an admin access key to use this endpoint"
        })
    }
}

const authenticateUser = async (req, res, next) => {
    try {
        console.log(req.headers.authorization)
        const token = req.headers.authorization.split(" ")[1]
        jwt.verify(token, process.env.SECRET_KEY, function(err, decoded) {
            return (decoded ? next() : next({
                status: 401,
                message: "Please login first"
            }));
        });
    } catch (err) {
        console.error(err);
        return next({
            status: 401,
            message: "You are not logged in"
        })
    }
};

/*const authorizeUser = async (req, res, next) => {
    try {
        console.log(req.headers)
        const token = req.headers.authorization.split(" ")[1]
        console.log(token)
        jwt.verify(token, process.env.SECRET_KEY, function (err, decoded) {
            return (decoded && decoded["_id"] === req.params["userId"] ? next() : next({
                status: 401,
                message: "Unauthorized"
            }));
        })
    } catch (err) {
        console.error(err)
        return next({
            status: 401,
            message: "Unauthorized"
        })
    }
};*/

module.exports = {
    authenticateUser,
    authenticateAdmin
}