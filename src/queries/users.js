const toObjectId = require('mongoose').Types.ObjectId
const { User, Account } = require('../schema')
const CustomError = require('../utils/error')
const formatNumber = require('../utils/formatNumber')

async function userById({ userID }) {
    if (typeof userID === 'string') userID = toObjectId(userID)

    return User.findOne({ _id: userID }, { __v: false, password: false })
        .populate('account')
        .exec()
}

module.exports = { userById }
