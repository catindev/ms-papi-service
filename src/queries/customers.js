const toObjectId = require('mongoose').Types.ObjectId
const { Account, Customer, Call } = require('../schema')
const CustomError = require('../utils/error')
const { userById } = require('./users')


async function leads({ userID, skip = 0 }) {
    /*
    Лиды: клиенты без менеджера или записанные за текущим менеджером.
    Формат: .....? 
    Нюансы: Без обратной сортировки по дате, чтобы новые были внизу и до них нужно было 
    скроллить — мотив к тому чтобы разгребать кучу в нужном порядке, а не самых свежих. 
    Без пагинации и, возможно, самых новых видно не будет если лидов 100500 с тем же 
    мотивом. 
    */

    if (typeof userID === 'string') userID = toObjectId(userID)
    
    const { account: { _id } } = await userById({ userID })

    const customers = await Customer.find({
        account: _id,
        funnelStep: 'lead',
        '$or': [{ user: { $exists: false } }, { user: userID }],
    }).skip(skip).limit(50)

    console.log('customers.length', customers.length)

    if (customers.length === 0) return customers

    const result = []  
    for (let customer of customers) {
      const clone = Object.assign({}, customer.toObject())
      const missed = await Call.find({ customer: customer._id, record: { $exists: false } }).count()
      const success = await Call.find({ customer: customer._id, record: { $exists: true } }).count()
      console.log('calls for',success,missed)
      clone.calls = { missed, success }
      result.push(clone)
    }      

    return result
  }


async function funnel({ userID }) {
    if (typeof userID === 'string') userID = toObjectId(userID)

    const { account: { _id, funnelSteps } } = await userById({ userID })

    const query = { 
      account: _id, user: userID, 
      funnelStep: { $in: Object.assign(['in-progress'], funnelSteps) } 
    }

    const customers = await Customer.find(query)
    
}


async function search({ 
  userID, step, searchQuery = 'undefined',
  options, fields = null
}) {
    if (typeof userID === 'string') userID = toObjectId(userID)

    if (step && searchQuery === 'undefined') searchQuery = ''  

    const searchOptions = [
        { name: { '$regex': searchQuery, '$options': 'i' } },
        { phones: { '$regex': searchQuery, '$options': 'i' } }
    ]

    const { account: { _id } } = await userById({ userID }, options)

    const query = {
        account: _id,
        '$or': [{ user: { $exists: false } }, { user: userID }],
    }

    if (step) query.funnelStep = step
    if (searchQuery) query.$or = Object.assign(query.$or, searchOptions) 

    options.skip && (options.skip = parseInt(options.skip))
    options.limit && (options.limit = parseInt(options.limit))  

    return await Customer.find(query, fields, options)
}


module.exports = { search, leads }