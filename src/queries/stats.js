const toObjectId = require('mongoose').Types.ObjectId
const { Account, Customer, User } = require('../schema')
const CustomError = require('../utils/error')
const { userById } = require('./users')
const { findIndex } = require('lodash')

async function statsLeads({ userID, skip = 0 }) {
    if (typeof userID === 'string') userID = toObjectId(userID)

    const { account: { _id } } = await userById({ userID })

    const missed = await Customer
        .find({ account: _id, user: { $exists: false }, funnelStep: 'lead' })
        .count()

    const withManagers = await Customer
        .find({ account: _id, user: { $exists: true }, funnelStep: 'lead' })
        .populate('user')
        .exec()

    const managers = withManagers.reduce((result, currentLead, i, all) => {
      const { user: { name } } = currentLead
      const index = findIndex(result, { manager: name })
      
      if (index !== -1) result[index].count += 1 
      else result.push({ manager: name, count: 1 })  

      return result  
    }, [])    

    return { missed, managers }
}

module.exports = { statsLeads }