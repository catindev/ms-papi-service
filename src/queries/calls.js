const { Call, Account, User, Customer } = require('../schema')
const toObjectId = require('mongoose').Types.ObjectId
const CustomError = require('../utils/error')
const { userById } = require('./users')
const { leads } = require('./customers')
const { sortBy } = require('lodash')
const humanDate = require('../utils/humanDate')

const populateQuery = [
    { path: 'customer', model: 'Customer' },
    { path: 'user', model: 'User' },
    {
        path: 'customer', model: 'Customer',
        populate: { path: 'user', model: 'User' }
    },
    { path: 'answeredBy', model: 'User' },
]


async function recentCalls({ userID }) {
    if (typeof userID === 'string') userID = toObjectId(userID)

    const { account: { _id } } = await userById({ userID })

    const calls = await Call
        .find({ account: _id, $or: [{ user: userID }, { user: { $exists: false } }] })
        .limit(25)
        .sort('-date')
        .populate(populateQuery)
        .lean()
        .exec()

    if (calls.length > 0) return calls.map(
        (call, index) => {
            const { _id, date, customer, record, isCallback, answeredBy, user } = call

            if (!customer) {
                console.log(index, call._id)
                return false
            }

            // тут геморно, но из-за того что ранее менеджер не писался
            // в звонок если звонок был пропущенный. поэтому приходится 
            // сначала проверять есть ли вообще у звонка менеджер
            const owner = user ?
                userID.toString() === user._id.toString() ? 'you' : user.name
                // answeredBy ?
                //     answeredBy._id.toString() === user._id.toString() ? 'you' : user.name
                //     :
                //     userID.toString() === user._id.toString() ? 'you' : user.name
                :
                customer && customer.user ?
                    userID.toString() === customer.user._id.toString() ? 'you' : customer.user.name
                    :
                    'lead'
                ;


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