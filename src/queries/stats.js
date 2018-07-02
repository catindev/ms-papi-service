const toObjectId = require('mongoose').Types.ObjectId
const { Account, Customer, User, Param, Trunk, Call, Breadcrumb } = require('../schema')
const CustomError = require('../utils/error')
const { userById, getUsers } = require('./users')
const { findIndex, isArray, orderBy, sortBy } = require('lodash')
const md5 = require('../utils/md5')
const humanDate = require('../utils/humanDate')
const request = require('request-promise')

const moment = require('moment')
moment.locale('ru')

function getLastUpdate(breadcrumbs) {
    if (!breadcrumbs || breadcrumbs.length === 0) return 'не известно'
    return moment(breadcrumbs[breadcrumbs.length - 1].date).fromNow()
}

// TODO: проверять на босса

async function getCallsStatsFromATS({ userID, start, end, type }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    const { account: { _id } } = await userById({ userID })

    const qs = `?interval_type=${type}&account_id=${_id}&interval_start=${start}&interval_end=${end}`

    const response = await request({
        uri: `https://pbxrec.mindsales.kz/mstelbot/newgraf.php${qs}`,
        json: true
    })

    return response
}

async function incomingTimeStatsFromATS({ userID, start, end }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    const { account: { _id } } = await userById({ userID })

    const qs = `?account_id=${_id}&interval_start=${start}&interval_end=${end}`

    const response = await request({
        uri: `https://pbxrec.mindsales.kz/mstelbot/graf_time_incoming.php${qs}`,
        json: true
    })

    return response
}

async function missingTimeStatsFromATS({ userID, start, end }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    const { account: { _id } } = await userById({ userID })

    const qs = `?account_id=${_id}&interval_start=${start}&interval_end=${end}`

    const response = await request({
        uri: `https://pbxrec.mindsales.kz/mstelbot/graf_time_missing.php${qs}`,
        json: true
    })

    return response
}

async function reactionStatsFromATS({ userID, start, end, type }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    const { account: { _id, maxWaitingTime } } = await userById({ userID })

    const qs = `?interval_type=${type}&account_id=${_id}&interval_start=${start}&interval_end=${end}&waiting_time=${maxWaitingTime / 1000}`

    const response = await request({
        uri: `https://pbxrec.mindsales.kz/mstelbot/graf_speed.php${qs}`,
        json: true
    })

    return response
}

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

    return { missed: halfMissed + overMissed, halfMissed, overMissed }
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


    let funnel = [], counter = 0
    const backFunnel = funnelSteps.reverse()

    const dealsQuery = { account: _id, funnelStep: 'deal', 'deal.date': { $gte: '2017-11-01' } }
    if (allCustomersQuery.created) dealsQuery.created = allCustomersQuery.created

    const deals = await Customer.find(dealsQuery).count()
    funnel.push({ step: 'Сделка', count: deals })
    counter = deals

    for (step of backFunnel) {
        const stepQuery = { account: _id, funnelStep: 'reject', 'reject.previousStep': step }
        if (allCustomersQuery.created) stepQuery.created = allCustomersQuery.created
        const count = await Customer.find(stepQuery).count()

        funnel.push({ step, count: count + counter })
        counter += count
    }

    const fromCalls = await Customer.find(allCustomersQuery).count()
    funnel.push({ step: 'Звонки', count: fromCalls + counter })

    return { funnel: funnel.reverse() }
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

    const params = await Param.find({ account: _id, type: { $in: ['select', 'multiselect'] } })

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
        const { id, name, items, type } = param

        const query = {
            account: _id,
            funnelStep: { $nin: ['lead', 'cold', 'deal', 'reject'] }
        }
        query[id] = { $exists: true, $ne: "", $not: { $size: 0 } }
        if (allCustomersQuery.created) query.created = allCustomersQuery.created
        const all = await Customer.find(query).lean().exec()

        const values = []
        for (item of items) {
            const search = type === 'select' ?
                all.filter(customer => customer[id] === item)
                :
                all.filter(customer => customer[id].indexOf(item) !== -1)

            const count = search ? search.length : 0
            const percents = count > 0 ? roundp(count, all.length) : 0

            if (percents !== 0) values.push({ name: item, count, percents })
        }


        stats.push({ name, all: all.length, values })
    }

    return stats
}


async function statsLeadsFromTrunks2({ userID, start, end }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    const { account: { _id } } = await userById({ userID })
    const results = []
    const query = { funnelStep: { $ne: 'cold' } }

    if (start || end) {
        query.created = {}
        if (start) query.created.$gte = start
        if (end) query.created.$lt = end
    }

    const trunks = await Trunk.find({ account: _id, active: true })
    for (let trunk of trunks) {
        query.trunk = trunk._id
        const customers = await Customer.find(query)
        // console.log('Query', query, 'search', customers.length)

        if (customers && customers.length > 0) {
            const deals = customers.filter(customer => customer.funnelStep === 'deal')
            const rejects = customers.filter(customer => customer.funnelStep === 'reject')
            const inProgress = customers.length - deals.length - rejects.length;
            // const conversion = Math.round((deals.length / customers.length) * 100)
            results.push({
                name: trunk.name,
                customers: customers.length,
                deals: deals.length,
                rejects: rejects.length,
                inProgress
            })
        }
    }

    return orderBy(results, ['customers'], ['desc'])
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
        if (customers && customers > 0)
            results.push({ name: trunk.name, customers })
    }

    return results
}

async function incomingCallsStats({ userID, start, end, interval }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    const { account: { _id } } = await userById({ userID })

    const Moment = require('moment')
    const MomentRange = require('moment-range')
    const moment = MomentRange.extendMoment(Moment)
    moment.locale('ru')

    function formatInterval(date, type, index) {
        if (type === 'weeks') return (index + 1) + ' неделя'
        if (type === 'months') return date.format('MMMM')
        return date.format('DD MMM')
    }

    const rangeItemToMongoQuery = (date, type, index) => ({
        name: formatInterval(date, type, index),
        date: {
            $gte: date.startOf(type).toDate(),
            $lt: date.endOf(type).toDate()
        }
    })

    const period = moment.range(new Date(start).toISOString(), new Date(end).toISOString())
    const listOfRanges = Array.from(period.by(interval, { step: 1 }))
    const listOfIntervals = listOfRanges.map((range, index) => rangeItemToMongoQuery(range, interval, index))

    // return listOfIntervals

    const results = []
    for (mongoInterval of listOfIntervals) {
        const calls = await Call.find({ account: _id, date: mongoInterval.date }).lean().exec()
        const missed = calls.filter(({ record }) => !record)
        const result = { name: mongoInterval.name }
        result['Входящие'] = calls.length
        result['Пропущенные'] = missed.length
        results.push(result)
    }


    return results
}


async function funnelAll({ userID, start, end, manager = false }) {

    function getId(name) {
        const hash = md5(name)
        return hash.replace(/[0-9]/g, '') + hash.replace(/\D/g, '')
    }

    function todayRange() {
        return {
            $gte: moment().startOf('day').toISOString(),
            $lt: moment().endOf('day').toISOString()
        }
    }

    function convertToTimestamp(date, time = '00:00') {
        const d = new Date(date)
        const t = time.split(':')
        d.setHours(t[0], t[1], 0)
        return d.getTime()
    }

    function isToday(date) {
        const d = moment(new Date(date))
        const today = moment().startOf('day')
        return d.isSame(today, 'd')
    }

    if (typeof userID === 'string') userID = toObjectId(userID)
    if (manager && typeof manager === 'string') manager = toObjectId(manager)
    const { account: { _id, funnelSteps } } = await userById({ userID })

    funnelSteps.unshift('in-progress')

    const query = { account: _id, funnelStep: { $in: funnelSteps } }
    manager && (query.user = manager)

    if (start || end) {
        query.created = {}
        if (start) query.created.$gte = start
        if (end) query.created.$lt = end
    }

    console.log(query)

    const customers = await Customer.find(query).populate('user breadcrumbs').select('_id name funnelStep user breadcrumbs').lean().exec()

    if (!customers || customers.length === 0) return []

    const normalizedCustomers = customers
        .map(({ _id, name, funnelStep, user, breadcrumbs = [] }) => ({
            _id, name, funnelStep, user: user.name,
            lastUpdate: getLastUpdate(breadcrumbs)
        }))

    return funnelSteps.reduce((result, step) => {
        result.push({
            name: step,
            id: getId(step),
            customers: normalizedCustomers
                .filter(customer => customer.funnelStep === step)
        })
        return result
    }, [])
}

async function closedCustomersStats({ userID, filter = '', start, end }) {
    if (typeof userID === 'string') userID = toObjectId(userID)

    const { account: { _id } } = await userById({ userID })
    const query = { account: _id, funnelStep: filter }

    if ((start || end) && filter === 'reject') {
        if (start) query['reject.date'] = { $gte: start }
        if (end) query['reject.date'] = { $lt: end }
    }

    if ((start || end) && filter === 'deal') {
        if (start) query['deal.date'] = { $gte: start }
        if (end) query['deal.date'] = { $lt: end }
    }

    const customers = await Customer.find(query).lean().exec()

    const reject = customers.filter(customer => customer.funnelStep === 'reject')
    const deal = customers.filter(customer => customer.funnelStep === 'deal')

    return { reject, deal }
}

async function rejectCustomersForStats({ userID, start, end, trunk = false, manager = false, by_created = false }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof trunk === 'string') trunk = toObjectId(trunk)
    if (typeof manager === 'string') manager = toObjectId(manager)

    console.log(start, end, trunk, manager, by_created)

    const { account: { _id } } = await userById({ userID })
    const query = {
        account: _id, funnelStep: 'reject',
        'reject.previousStep': { $nin: ['lead', 'cold', 'deal', 'reject'] }
    }

    if (by_created && (start || end)) {
        query['created'] = {}
        if (start) query['created'].$gte = start
        if (end) query['created'].$lt = end
    } else {
        if (start || end) {
            query['reject.date'] = {}
            if (start) query['reject.date'].$gte = start
            if (end) query['reject.date'].$lt = end
        }
    }

    if (trunk) query.trunk = trunk
    if (manager) query.user = manager

    console.log(query)

    const customers = await Customer.find(query)
        .sort(by_created ? '-created' : '-reject.date').populate('user').lean().exec()

    return customers.map(({ name, reject, user, _id }) => ({
        _id, name,
        reason: reject.reason === 'Другое' ? reject.comment || reject.reason : reject.reason,
        date: humanDate(reject.date),
        user: user.name
    }))
}

async function badLeadsProfilesForStats({ userID, start, end, trunk = false, manager = false, by_created = false }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof trunk === 'string') trunk = toObjectId(trunk)
    if (typeof manager === 'string') manager = toObjectId(manager)

    const { account: { _id } } = await userById({ userID })
    const query = {
        account: _id, funnelStep: 'reject',
        'reject.previousStep': 'lead'
    }

    if (by_created && (start || end)) {
        query['created'] = {}
        if (start) query['created'].$gte = start
        if (end) query['created'].$lt = end
    } else {
        if (start || end) {
            query['reject.date'] = {}
            if (start) query['reject.date'].$gte = start
            if (end) query['reject.date'].$lt = end
        }
    }

    if (trunk) query.trunk = trunk
    if (manager) query.user = manager

    console.log(query)

    const customers = await Customer.find(query)
        .sort(by_created ? '-created' : '-reject.date').populate('user').lean().exec()

    return customers.map(({ name, reject, user, _id }) => ({
        _id, name,
        reason: reject.reason === 'Другое' ? reject.comment || reject.reason : reject.reason,
        date: humanDate(reject.date),
        user: user ? user.name : ''
    }))
}

async function dealCustomersForStats({ userID, start, end, trunk = false, manager = false, by_created = false }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof trunk === 'string') trunk = toObjectId(trunk)
    if (typeof manager === 'string') manager = toObjectId(manager)

    const { account: { _id } } = await userById({ userID })
    const query = { account: _id, funnelStep: 'deal' }

    if (by_created && (start || end)) {
        query['created'] = {}
        if (start) query['created'].$gte = start
        if (end) query['created'].$lt = end
    } else {
        if (start || end) {
            query['deal.date'] = {}
            if (start) query['deal.date'].$gte = start
            if (end) query['deal.date'].$lt = end
        }
    }


    if (trunk) query.trunk = trunk
    if (manager) query.user = manager

    return await Customer.find(query)
        .sort(by_created ? '-created' : '-deal.date').lean().exec()
}

async function qeuedLeadsForStats({ userID, start, end, trunk = false, manager = false }) {
    if (typeof userID === 'string') userID = toObjectId(userID)

    const { account: { _id } } = await userById({ userID })
    const query = { account: _id, funnelStep: 'lead', user: { $exists: true } }

    if (start || end) {
        query.created = {}
        if (start) query.created.$gte = start
        if (end) query.created.$lt = end
    }

    if (trunk) query.trunk = trunk
    if (manager) query.user = manager

    const customers = await Customer.find(query).sort('-created').populate('trunk breadcrumbs user').lean().exec()

    return customers
    // return customers.map(({ _id, name, trunk, user }) => ({ _id, name, lastUpdate: getLastUpdate(breadcrumbs), trunk: trunk.name, user: user.name }))
}

async function customersByUsers({ userID }) {
    if (typeof userID === 'string') userID = toObjectId(userID)

    const { account: { _id } } = await userById({ userID })
    const users = await getUsers({ userID })

    const result = []
    for (let user of users) {
        const customers = await Customer
            .find({
                account: _id, user: user._id,
                funnelStep: { $nin: ['lead', 'cold', 'deal', 'reject'] }
            })
            .count()
        result.push({ user: user.name, customers })
    }

    return orderBy(result, ['customers'], ['desc'])
}


async function usersStats({ userID, start, end }) {
    if (typeof userID === 'string') userID = toObjectId(userID)

    const { account: { _id } } = await userById({ userID })

    function setPeriod({ query, start, end }) {
        const clone = JSON.parse(JSON.stringify(query))
        if (start || end) {
            clone.created = {}
            if (start) clone.created.$gte = start
            if (end) clone.created.$lt = end
        }
        return clone
    }

    const users = await getUsers({ userID })

    const result = []
    for (let user of users) {
        let dealsQuery = { account: _id, user: user._id, funnelStep: 'deal' }
        if (start || end) dealsQuery = setPeriod({ query: dealsQuery, start, end })
        const deals = await Customer.find(dealsQuery).count()

        let rejectsQuery = { account: _id, user: user._id, funnelStep: 'reject' }
        if (start || end) rejectsQuery = setPeriod({ query: rejectsQuery, start, end })
        const rejects = await Customer.find(rejectsQuery).count()

        const customers = deals + rejects

        if (customers > 0) result.push({
            user: user.name,
            deals, rejects,
            customers
        })
    }

    return orderBy(result, ['customers', 'deals'], ['desc'])
}

module.exports = {
    managersLeads,
    statsClosed,
    statsInProgress,
    customerPortrait,
    statsLeadsFromTrunks,
    fuckedLeads,
    incomingCallsStats,
    funnelAll,
    statsLeadsFromTrunks2,

    // profiles
    rejectCustomersForStats,
    dealCustomersForStats,
    badLeadsProfilesForStats,
    qeuedLeadsForStats,

    // users
    usersStats, customersByUsers,

    // ATS API
    getCallsStatsFromATS,
    incomingTimeStatsFromATS,
    missingTimeStatsFromATS,
    reactionStatsFromATS
}