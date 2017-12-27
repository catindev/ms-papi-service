const { Call, Account, User, Customer } = require('../schema')
const toObjectId = require('mongoose').Types.ObjectId
const CustomError = require('../utils/error')
const { userById } = require('./users')
const humanDate = require('../utils/humanDate')

async function recentCalls({ userID }) {
    if (typeof userID === 'string') userID = toObjectId(userID)

    const { account: { _id } } = await userById({ userID })

    const calls = await Call
        .find({ account: _id, user: userID })
        .limit(15)
        .sort('-date')
        .populate('customer user answeredBy')
        .lean()
        .exec()

    if (calls.length > 0) return calls.map(
        ({ _id, date, customer, record, isCallback, answeredBy, user }) => {
            const owner = answeredBy ?
                answeredBy._id.toString() === user._id.toString() ? 'you' : user.name
                :
                userID.toString() === user._id.toString() ? 'you' : user.name 

            return {
                _id,
                date: humanDate(date),
                customer: { id: customer._id, name: customer.name, funnelStep: customer.funnelStep },
                missed: !record,
                isCallback,
                owner
            }
        }
    )

    return []
}

module.exports = { recentCalls }