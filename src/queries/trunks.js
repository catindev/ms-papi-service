const toObjectId = require('mongoose').Types.ObjectId
const { Account, Customer, Call, Trunk, Param, Log } = require('../schema')
const CustomError = require('../utils/error')
const { userById } = require('./users')

async function getTrunks({ userID }) {
  if (typeof userID === 'string') userID = toObjectId(userID)

  const { account: { _id } } = await userById({ userID })

  return Trunk.find({ account: _id })
}

// TODO: дать нормальное название (узнать эффективность транков)
async function getLeadsStats({ accountID }) {
  if (typeof accountID === 'string') accountID = toObjectId(accountID)
  const results = []

  const trunks = await Trunk.find({ account: accountID })

  for (let trunk of trunks) {
    const customers = await Customer.find({ trunk: trunk._id }).count()
    if (customers && customers > 0) results.push({ name: trunk.name, customers })
  }

  return results
}

module.exports = { getLeadsStats, getTrunks }