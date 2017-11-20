const toObjectId = require('mongoose').Types.ObjectId
const { Account, Customer, User } = require('../schema')
const CustomError = require('../utils/error')
const { userById } = require('./users')
const { findIndex } = require('lodash')

async function statsLeads({ userID, skip = 0 }) {
    if (typeof userID === 'string') userID = toObjectId(userID)

    const { account: { _id } } = await userById({ userID })

    const all = await Customer
        .find({ account: _id, user: { $exists: false }, funnelStep: 'lead' })
        .count()

    const leadsWithManagers = await Customer
        .find({ account: _id, user: { $exists: true }, funnelStep: 'lead' })
        .populate('user')
        .exec()

    const managers = leadsWithManagers.reduce((result, currentLead, i, all) => {
      const index = findIndex(result, { manager: currentLead.user.name })
      if (index !== -1) result[index].count ++
      else result.push({ manager: currentLead.user.name, count: 1 })  
      return result  
    }, [])    

    return { all, managers }
}

module.exports = { statsLeads }