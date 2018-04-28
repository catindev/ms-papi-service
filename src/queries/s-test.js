const toObjectId = require('mongoose').Types.ObjectId
const { Account, Customer, User, Param, Trunk, Call } = require('../schema')
const CustomError = require('../utils/error')
const { userById, getUsers } = require('./users')
const { findIndex, isArray, orderBy, sortBy } = require('lodash')
const md5 = require('../utils/md5')
const humanDate = require('../utils/humanDate')

const moment = require('moment')
moment.locale('ru')

function getTodayRange() {
    return {
        $gte: moment().startOf('day').toISOString(),
        $lt: moment().endOf('day').toISOString()
    }
}

module.exports = async function SamrukReport() {
    const accountID = toObjectId('59f840fc94d14316e76321b4')
    const todayRange = getTodayRange()

    const results = []
    const trunks = await Trunk.find({ account: accountID, active: true })

    for (let trunk of trunks) {
        const all = await Customer.find({ account: accountID, created: todayRange, trunk: trunk._id })
        let result = { name: trunk.name, all: all.length }

        if (!all || all.length === 0) {
            result.missed = 0
            result.overMissed = 0
            results.push(result)
        } else {
            const missed = await Customer.find({ account: accountID, user: { $exists: false }, funnelStep: 'lead', created: todayRange, trunk: trunk._id })
            let overMissed = 0, halfMissed = 0
            for (customer of missed) {
                const badcalls = await Call.find({ customer: customer._id, record: { $exists: false }, isCallback: false }).count()
                const badrecalls = await Call.find({ customer: customer._id, record: { $exists: false }, isCallback: true }).count()

                if (badcalls > 0 && badrecalls === 0) overMissed++
                if (badcalls > 0 && badrecalls > 0) halfMissed++
            }
            results.push({
                name: trunk.name,
                customers: all.map(({ _id, name, funnelStep }) => _id),
                all: all.length,
                missed: halfMissed + overMissed,
                overMissed
            })
        }


    }

    return results
}