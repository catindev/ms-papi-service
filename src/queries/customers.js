const toObjectId = require('mongoose').Types.ObjectId
const { Account, Customer, Call, Trunk } = require('../schema')
const CustomError = require('../utils/error')
const formatNumber = require('../utils/formatNumber')
const formatNumberForHumans = require('../utils/formatNumberForHumans')
const { userById } = require('./users')
const request = require('request-promise')


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
        }, null, { skip, limit: 50 })

    if (customers.length === 0) return customers

    const result = []

    for (let customer of customers) {
        const call = await Call.findOne({ customer: customer._id }).sort('-_id')
        const state = !call || !call.record? 'WAIT_RECALL' : 'WAIT_PROFILE'
        result.push(Object.assign({}, customer.toObject(), { state }))
    }

    return result
}


async function coldLeads({ userID, skip = 0 }) {
    if (typeof userID === 'string') userID = toObjectId(userID)

    const { account: { _id } } = await userById({ userID })

    const customers = await Customer.find({
            account: _id,
            funnelStep: 'cold',
            user: userID
        }, null, { skip, limit: 50 })

    return customers
}


async function createColdLead({ userID, data }) {
    if (typeof userID === 'string') userID = toObjectId(userID)

    const { account: { _id } } = await userById({ userID })

    const trunk = await Trunk.findOne({ account: _id })

    data.phones = formatNumber(data.phones)

    const newCustomer = new Customer(Object.assign({}, data, {
      account: _id,
      user: userID, 
      funnelStep: 'cold',
      trunk: trunk._id
    }))

    return await newCustomer.save()
}


async function cutomerById({ userID, customerID }) {
  if (typeof userID === 'string') userID = toObjectId(userID)
  if (typeof customerID === 'string') customerID = toObjectId(customerID)

  const { account: { _id } } = await userById({ userID })  

  const customer = await Customer.findOne({ account: _id, _id: customerID})
    .populate('account').exec()

  if (customer) customer.phones = customer.phones.map(formatNumberForHumans)  

  return customer  
}


async function funnel({ userID }) {
    if (typeof userID === 'string') userID = toObjectId(userID)

    const { account: { _id, funnelSteps } } = await userById({ userID })

    const query = {
        account: _id,
        user: userID,
        funnelStep: { $in: Object.assign(['in-progress'], funnelSteps) }
    }

    const customers = await Customer.find(query)

}


async function search({
    userID,
    step,
    searchQuery = 'undefined',
    options,
    fields = null
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


async function call({ userID, customerID }) {
  if (typeof userID === 'string') userID = toObjectId(userID)
  if (typeof customerID === 'string') customerID = toObjectId(customerID)

  const { account: { _id }, phones } = await userById({ userID }) 
  const customer = await Customer.findOne({ _id: customerID, account: _id }).populate('trunk').exec()

  const options = {
      uri: 'http://185.22.65.50/call.php',
      qs: {
          cn: customer.phones[0].replace('+7', '8'),
          un: phones[0].replace('+7', '8'),
          tr: customer.trunk.phone.replace('+7', '8'),
          call_id: 'ms3'
      },
      headers: { 'User-Agent': 'Request-Promise' },
      json: true
  }

  return await request(options)
}


module.exports = { search, leads, call, coldLeads, createColdLead, cutomerById }