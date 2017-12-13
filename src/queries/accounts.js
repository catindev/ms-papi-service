const { Account } = require('../schema')

async function allAccounts() {
  return await Account.find({}, { name: 1 }).exec()
}

module.exports = { allAccounts }