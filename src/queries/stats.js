const toObjectId = require('mongoose').Types.ObjectId
const { Account, Customer, User, Param, Trunk, Call } = require('../schema')
const CustomError = require('../utils/error')
const { userById } = require('./users')
const { findIndex, isArray } = require('lodash')

// TODO: проверять на босса

async function fuckedLeads({ userID }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    const { account: { _id } } = await userById({ userID }) 
    
    const missed = await Customer
        .find({ account: _id, user: { $exists: false }, funnelStep: 'lead' })

    let overMissed = 0, halfMissed = 0
    for (customer of missed) {
      const badcalls = await Call.find({ customer: customer._id, record: { $exists: false }, isCallback: false }).count()
      const badrecalls = await Call.find({ customer: customer._id, record: { $exists: false }, isCallback: true }).count()
      
      if (badcalls > 0 && badrecalls === 0) overMissed++
      if (badcalls > 0 && badrecalls > 0) halfMissed++
    } 

    return { missed: missed.length, halfMissed, overMissed }  

}


async function managersLeads({ userID }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    const { account: { _id } } = await userById({ userID })

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

    return managers
}

async function statsClosed({ userID, start, end }) {
    if (typeof userID === 'string') userID = toObjectId(userID)

    const { account: { _id, funnelSteps } } = await userById({ userID })

    const allCustomersQuery = { account: _id, funnelStep: 'reject', 'reject.previousStep': 'in-progress' }
    if (start || end) {
      allCustomersQuery.created = {}
      if (start) allCustomersQuery.created.$gte = start
      if (end) allCustomersQuery.created.$lt = end 
    }  
    const all = await Customer.find(allCustomersQuery).count()


    let funnel = [],
        counter = 0
    const backFunnel = funnelSteps.reverse()

    const dealsQuery = { account: _id, funnelStep: 'deal', 'deal.date': { $gte: '2017-11-01' } }
    if (allCustomersQuery.created) dealsQuery.created = allCustomersQuery.created

    const deals = await Customer.find(dealsQuery).count()
    funnel.push({ step: 'Сделка', count: deals })

    for (step of backFunnel) {
        const stepQuery = { account: _id, funnelStep: 'reject', 'reject.previousStep': step }
        if (allCustomersQuery.created) stepQuery.created = allCustomersQuery.created
        const count = await Customer.find(stepQuery).count()

        funnel.push({ step, count: count + counter })
        counter += count
    }

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

    for (step of funnelSteps) {
        const count = await Customer
            .find({ account: _id, funnelStep: step })
            .count()

        funnel.push({ step, count: count })
    }

    return { all, funnel }
}


async function customerPortrait({ userID, start, end }) {

    function roundp(number, from) {
        const p = (number / from * 100).toFixed(1);
        const splitted = (p + "").split('.');
        const fst = parseInt(splitted[0]);
        const scnd = parseInt(splitted[1]);
        return scnd === 0 ? `${fst}` : `${p}`;
    }

    if (typeof userID === 'string') userID = toObjectId(userID)

    const { account: { _id } } = await userById({ userID })
    const stats = []

    const params = await Param.find({ account: _id, type: { $in: ['select'] } })

    if (!params || params.length === 0) return []

    const allCustomersQuery = {
        account: _id,
        funnelStep: { $nin: ['lead', 'cold', 'deal', 'reject'] }
    }

    if (start || end) {
      allCustomersQuery.created = {}
      if (start) allCustomersQuery.created.$gte = start
      if (end) allCustomersQuery.created.$lt = end 
    }  

    const allCustomers = await Customer.find(allCustomersQuery)

    for (param of params) {
        const { id, name, items } = param

        const query = {
            account: _id,
            funnelStep: { $nin: ['lead', 'cold', 'deal', 'reject'] }
        }
        query[id] = { $exists: true, $ne: "", $not: { $size: 0 } }
        if (allCustomersQuery.created) query.created = allCustomersQuery.created
        const all = await Customer.find(query)

        const values = []
        for (item of items) {
            const search = all.filter(customer => {
                const clone = customer.toObject()
                return clone[id] === item
            })
            const count = search ? search.length : 0
            const percents = count > 0 ? roundp(count, all.length) : 0

            if (percents !== 0) values.push({ name: item, count, percents })
        }


        stats.push({ name, all: all.length, values })
    }

    return stats
}


async function statsLeadsFromTrunks({ userID, start, end }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    const { account: { _id } } = await userById({ userID })
    const results = []
    const query = {}

    if (start || end) {
      query.created = {}
      if (start) query.created.$gte = start
      if (end) query.created.$lt = end 
    }    

    const trunks = await Trunk.find({ account: _id })
    for (let trunk of trunks) {
        query.trunk = trunk._id
        const customers = await Customer.find(query).count()
        if (customers && customers > 0) results.push({ name: trunk.name, customers })
    }

    return results
}

// async function incomingCallsStats({ userID, start, end, interval }) {
//     if (typeof userID === 'string') userID = toObjectId(userID)
//     const { account: { _id } } = await userById({ userID })

//     const Moment = require('moment')
//     const MomentRange = require('moment-range')
//     const moment = MomentRange.extendMoment(Moment)
//     moment.locale('ru')

//     function formatInterval(date, type, index) {
//       if (type === 'weeks') return (index + 1) + ' неделя'
//       if (type === 'months') return date.format('MMMM')
//       return date.format('DD MMM')  
//     }

//     const rangeItemToMongoQuery = (date, type, index) => ({
//       name: formatInterval(date, type, index),
//       date: {
//         $gte: date.startOf( type ).toDate(),
//         $lt: date.endOf( type ).toDate()
//       }
//     })

//     const period = moment.range(new Date(start).toISOString(), new Date(end).toISOString())
//     const listOfRanges = Array.from(period.by(interval, { step: 1 }))
//     const listOfIntervals = listOfRanges.map( (range, index) => rangeItemToMongoQuery(range, interval, index))

//     const results = []
//     for( mongoInterval of listOfIntervals) {
//       const calls = await Call.find({ account: _id, date: mongoInterval.date }).lean().exec()
//       const missed = calls.filter(({ record }) => !record )
//       const result = { name: mongoInterval.name }
//       result['Входящие'] = calls.length
//       result['Пропущенные'] = missed.length
//       results.push(result)
//     }


//     return results 
// }

module.exports = { 
  managersLeads, 
  statsClosed, 
  statsInProgress, 
  customerPortrait, 
  statsLeadsFromTrunks,
  fuckedLeads
}