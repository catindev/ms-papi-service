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

async function updateUser({ userID, data }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if ('phones' in data) data.phones = data.phones.map(formatNumber)

    return User.update({ _id: userID }, data)
}

async function getUsers({ userID }) {
    if (typeof userID === 'string') userID = toObjectId(userID)

    const { account: { _id } } = await userById({ userID })

    return User.find({ account: _id })
}

module.exports = { userById, getUsers }
