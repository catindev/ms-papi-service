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

async function statsClosed({ userID }) {
    if (typeof userID === 'string') userID = toObjectId(userID)

    const { account: { _id, funnelSteps } } = await userById({ userID }) 

    const all = await Customer
        .find({ account: _id, funnelStep: { $in: ['deal', 'reject'] } })
        .count()


    let funnel = [], counter = 0   
    const backFunnel = funnelSteps.reverse()

    const deals = await Customer
      .find({ account: _id, funnelStep: 'deal' })
      .count()
    funnel.push({ step: 'Сделка', count: deals })     

    for(step of backFunnel) {
      const count = await Customer
        .find({ account: _id, funnelStep: 'reject', 'reject.previousStep': step })
        .count()

      funnel.push({ step, count: count + counter })  
      counter += count
    }               

    const badLeads = await Customer
      .find({ 
        account: _id, 
        funnelStep: 'reject', 
        'reject.previousStep': { $in: ['lead', 'cold'] } 
      })
      .count()
    funnel.push({ step: 'Звонки', count: badLeads })  

    return { all, funnel: funnel.reverse() }    
}


async function statsInProgress({ userID }) {
    if (typeof userID === 'string') userID = toObjectId(userID)

    const { account: { _id, funnelSteps } } = await userById({ userID }) 

    const all = await Customer
        .find({ 
          account: _id, 
          funnelStep: { $nin: ['lead', 'cold', 'deal', 'reject'] } 
        })
        .count()


    let funnel = []  
    const inProgress = await Customer
      .find({ account: _id, funnelStep: 'in-progress' })
      .count()
    funnel.push({ step: 'В работе', count: inProgress })     

    for(step of funnelSteps) {
      const count = await Customer
        .find({ account: _id, funnelStep: step })
        .count()

      funnel.push({ step, count: count })  
    }               

    return { all, funnel }    
}

module.exports = { statsLeads, statsClosed, statsInProgress }