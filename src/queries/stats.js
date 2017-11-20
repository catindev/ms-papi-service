const toObjectId = require('mongoose').Types.ObjectId
const { Account, Customer, User } = require('../schema')
const CustomError = require('../utils/error')
const { userById } = require('./users')
const { findIndex } = require('lodash')

// TODO: проверять на босса

async function statsLeads({ userID }) {
    if (typeof userID === 'string') userID = toObjectId(userID)

    const { account: { _id } } = await userById({ userID })

    const missed = await Customer
        .find({ account: _id, user: { $exists: false }, funnelStep: 'lead' })
        .count()

    const withManagers = await Customer
        .find({ account: _id, user: { $exists: true }, funnelStep: 'lead' })
        .populate('user')
        .exec()

    const managers = withManagers.reduce((stats, currentLead) => {
      const { user: { name } } = currentLead
      const index = findIndex(stats, { manager: name })
      
      if (index !== -1) stats[index].count++ 
      else stats.push({ manager: name, count: 1 })  

      return stats  
    }, [])    

    return { missed, managers }
}

async function statsFunnel({ userID }) {
    if (typeof userID === 'string') userID = toObjectId(userID)

    const { account: { _id, funnelSteps } } = await userById({ userID }) 

    const all = await Customer
        .find({ account: _id, funnelStep: { $in: ['deal', 'reject'] } })
        .count()



    let funnel = [], counter = 0   
    const backFunnel = funnelSteps.reverse()
    
    for(step of backFunnel) {
      const count = await Customer
        .find({ account: _id, funnelStep: 'reject', 'reject.previousStep': step })
        .count()

      funnel.push({ step, count })  
      counter += count
    }          

    return { all, funnel }    
}

module.exports = { statsLeads, statsFunnel }