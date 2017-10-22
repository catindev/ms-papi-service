const toObjectId = require('mongoose').Types.ObjectId
const { Admin, Param, Account, Session } = require('../schema')
const { haveAccessToAccount } = require('./accounts')
const CustomError = require('../utils/error')

async function createParam({ accountID, adminID, name }) {
    if (typeof accountID === 'string') accountID = toObjectId(accountID)
    if (typeof adminID === 'string') adminID = toObjectId(adminID)

    const canCreate = await haveAccessToAccount({ admin: adminID, account: accountID })
    if (canCreate === false)
        throw new CustomError('У вас недостаточно прав доступа для этого действия', 403)

    const newParam = new Param({ name, account: accountID });
    return newParam.save()
}

async function paramById({ adminID, accountID, paramID }) {
    if (typeof accountID === 'string') accountID = toObjectId(accountID)
    if (typeof paramID === 'string') paramID = toObjectId(paramID)
    if (typeof adminID === 'string') adminID = toObjectId(adminID)

    const canFetch = await haveAccessToAccount({ admin: adminID, account: accountID })  
    if (canFetch === false)
        throw new CustomError('У вас недостаточно прав доступа для этого действия', 403)

    return Param.findOne({ _id: paramID }, { __v: false })
}

async function allParams({ adminID, accountID, query = {} }) {
    if (typeof accountID === 'string') accountID = toObjectId(accountID)
    if (typeof adminID === 'string') adminID = toObjectId(adminID)

    const canFetch = await haveAccessToAccount({ admin: adminID, account: accountID })  
    if (canFetch === false)
        throw new CustomError('У вас недостаточно прав доступа для этого действия', 403)

    return Param.find(
        Object.assign({ account: accountID }, query), { name: 1 }
    )
}

async function updateParam({ adminID, accountID, paramID, data }) {
    if (typeof accountID === 'string') accountID = toObjectId(accountID)
    if (typeof paramID === 'string') paramID = toObjectId(paramID)
    if (typeof adminID === 'string') adminID = toObjectId(adminID)

    const canUpdate = await haveAccessToAccount({ admin: adminID, account: accountID })  
    if (canUpdate === false)
        throw new CustomError('У вас недостаточно прав доступа для этого действия', 403)

    return Param.update({ _id: paramID }, data)
}

module.exports = { createParam, paramById, allParams, updateParam }