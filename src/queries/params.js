const toObjectId = require('mongoose').Types.ObjectId
const { Admin, Param, Account, Session } = require('../schema')
const { haveAccessToAccount } = require('./accounts')
const CustomError = require('../utils/error')

async function paramById({ adminID, accountID, paramID }) {
    if (typeof accountID === 'string') accountID = toObjectId(accountID)
    if (typeof paramID === 'string') paramID = toObjectId(paramID)
    if (typeof adminID === 'string') adminID = toObjectId(adminID)

    const canFetch = await haveAccessToAccount({ admin: adminID, account: accountID })  
    if (canFetch === false)
        throw new CustomError('У вас недостаточно прав доступа для этого действия', 403)

    return Param.findOne({ _id: paramID }, { __v: false })
}

async function allParams({ userID }) {
    if (typeof userID === 'string') userID = toObjectId(userID)

    const user = User.findOne({ _id: userID })
    if (!user || user === null) throw new CustomError('У вас нет доступа к этим данным', 403)

    return Param.find({ account: user.account }, { name: 1 })
}

module.exports = { createParam, paramById, allParams, updateParam }