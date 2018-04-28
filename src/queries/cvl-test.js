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

module.exports = async function () {
    const accountID = toObjectId('5a6725d6f45a3f2913db2d03')

    const results = []
    const trunks = await Trunk.find({ account: accountID, active: true })

    for (let trunk of trunks) {
        // находим лидов без менеджера
        const missed = await Customer
            .find({ account: accountID, trunk: trunk._id, user: { $exists: false }, funnelStep: 'lead' })

        results.push({ name: trunk.name, missed: missed.length })
    }

    return results
}