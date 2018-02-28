const toObjectId = require('mongoose').Types.ObjectId
const { Account, Customer, Contact, Call, Trunk, Param, Log } = require('../schema')
const CustomError = require('../utils/error')
const formatNumber = require('../utils/formatNumber')
const formatNumberForHumans = require('../utils/formatNumberForHumans')
const humanDate = require('../utils/humanDate')
const formatDate = require('../utils/formatDate')
const { userById } = require('./users')
const { addLog } = require('./logs')
const request = require('request-promise')
const md5 = require('../utils/md5')
const moment = require('moment')
const { sortBy } = require('lodash')
const { createContact } = require('./contacts')

async function updateLast({ userID, customerID, lastActivity }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const { account: { _id, funnelSteps } } = await userById({ userID })

    return await Customer.findOneAndUpdate(
        { _id: customerID, user: userID, account: _id },
        { $set: { lastUpdate: new Date(), lastActivity } },
        { new: true })
}

async function setTask({ userID, customerID, when, what, time = '00:00' }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const { account: { _id } } = await userById({ userID })

    when = new Date(when)

    return await Customer.findOneAndUpdate(
        { _id: customerID, user: userID, account: _id },
        { $set: { 'task.what': what, 'task.when': when, 'task.time': time } },
        { new: true })
}

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

    const options = { skip, limit: 50 }
    const customers = await Customer.find({
        account: _id,
        funnelStep: 'lead',
        '$or': [{ user: { $exists: false } }, { user: userID }],
    }).sort('_id').lean().exec()

    if (customers.length === 0) return customers

    const result = []

    for (let customer of customers) {
        const state = !customer.user ? 'WAIT_RECALL' : 'WAIT_PROFILE'
        result.push(Object.assign({}, customer, { state }))
    }

    return result
}


async function coldLeads({ userID, skip = 0 }) {
    if (typeof userID === 'string') userID = toObjectId(userID)

    const { account: { _id } } = await userById({ userID })

    const options = { skip, limit: 50 }
    const customers = await Customer.find({
        account: _id,
        funnelStep: 'cold',
        user: userID
    }).sort('_id')

    return customers
}


async function recents({ userID, skip = 0 }) {
    if (typeof userID === 'string') userID = toObjectId(userID)

    const { account: { _id } } = await userById({ userID })

    const options = { skip, limit: 50 }
    const customers = await Customer
        .find({
            account: _id,
            user: userID,
            funnelStep: { $nin: ['lead'] },
            lastActivity: { $exists: true }
        })
        .sort('-lastUpdate')

    return customers
}

async function createColdLead({ userID, data }) {
    if (typeof userID === 'string') userID = toObjectId(userID)

    const { account: { _id } } = await userById({ userID })

    data.phones = formatNumber(data.phones)
    const customer = await Customer.findOne({ account: _id, phones: data.phones })
    if (customer) throw new CustomError('Номер уже зарегистрирован', 400)

    const trunk = await Trunk.findOne({ account: _id })

    const newCustomer = new Customer(Object.assign({}, data, {
        account: _id,
        user: userID,
        funnelStep: 'cold',
        trunk: trunk._id,
        lastUpdate: new Date(),
        contacts: [],
        lastActivity: 'добавлен в холодные'
    }))
    const createdLead = await newCustomer.save()

    return await createContact({
        userID, customerID: createdLead._id, data: {
            name: 'Основной',
            phone: createdLead.phones[0],
        }
    })
}


async function customerById({ userID, customerID, params = false }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const user = await userById({ userID })
    const { account: { _id } } = user

    let customer = await Customer.findOne({ account: _id, _id: customerID })
        .populate('account trunk user').exec()

    if (!customer) throw new CustomError('Клиент не найден', 404)

    if (customer.user && !customer.user._id.equals(userID)) {
        // throw new CustomError('Клиент назначен на другого менеджера', 404)
    }

    customer = customer.toObject()
    customer.phones = customer.phones.map(formatNumberForHumans)

    if (customer.task) {
        customer.task.displayWhen = humanDate(customer.task.when, true)
        customer.task.when = formatDate(customer.task.when, 'YYYY-MM-DD')
    }

    const calls = await Call.find({ customer: customerID, account: _id }).sort('-_id').lean().exec()

    if (calls.length > 0) {
        customer = Object.assign({}, customer, { calls })
        customer.calls = customer.calls.map(call => {
            const clone = Object.assign({}, call)
            clone.date = humanDate(clone.date)
            return clone
        })
    }

    if (params) {
        const params = await Param.find({ account: _id }).lean().exec()
        if (params) customer = Object.assign({}, customer, { params })
    }

    return customer
}

async function rejectCustomer({ userID, customerID, reason, comment = '', name = false }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const { account: { _id } } = await userById({ userID })

    const customer = await Customer.findOne({ _id: customerID, account: _id }).lean().exec()

    if (!customer) throw new CustomError('Клиент не найден', 400)

    const { funnelStep, user } = customer
    const reject = {
        reason,
        comment,
        previousStep: funnelStep,
        date: new Date()
    }
    if (name) reject.name = name

    return await Customer.findOneAndUpdate(
        { _id: customerID, account: _id },
        {
            $set: {
                funnelStep: 'reject',
                lastUpdate: new Date(),
                lastActivity: 'оформлен отказ',
                reject,
                user: user ? user : userID
            }
        }, { new: true })
}


async function dealCustomer({ userID, customerID, amount, comment = '' }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const { account: { _id } } = await userById({ userID })

    const customer = await Customer.findOne({ _id: customerID, account: _id, user: userID }).lean().exec()

    if (!customer) throw new CustomError('Клиент не найден', 400)

    const { funnelStep } = customer

    return await Customer.findOneAndUpdate({ _id: customerID, account: _id, user: userID }, {
        $set: {
            funnelStep: 'deal',
            lastUpdate: new Date(),
            lastActivity: 'продажа',
            deal: {
                amount,
                comment,
                previousStep: funnelStep,
                date: new Date()
            },
        }
    }, { new: true })
}


async function closedCustomers({ userID, filter = 'all' }) {
    if (typeof userID === 'string') userID = toObjectId(userID)

    const { account: { _id } } = await userById({ userID })
    const query = { account: _id, user: userID }

    if (filter === 'all') query.$or = [{ funnelStep: 'reject' }, { funnelStep: 'deal' }]
    if (filter === 'reject') query.funnelStep = 'reject'
    if (filter === 'deal') query.funnelStep = 'deal'

    const customers = await Customer.find(query).lean().exec()

    const reject = customers.filter(customer => customer.funnelStep === 'reject')
    const deal = customers.filter(customer => customer.funnelStep === 'deal')

    return { reject, deal }
}

async function comeBackCustomer({ userID, customerID }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const { account: { _id } } = await userById({ userID })

    const customer = await Customer.findOne({ _id: customerID, account: _id }).lean().exec()

    if (!customer) throw new CustomError('Клиент не найден', 400)

    return await Customer.findOneAndUpdate(
        { _id: customerID, account: _id },
        {
            $set: {
                funnelStep: 'in-progress',
                lastUpdate: new Date(),
                lastActivity: 'возврат в работу'
            }
        }, { new: true })
}

async function updateCustomer({ userID, customerID, body }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const { account: { _id } } = await userById({ userID })

    const customer = await Customer.findOne({ _id: customerID, account: _id }).lean().exec()
    if (!customer) throw new CustomError('Клиент не найден или назначен на другого менеджера', 400)


    const { funnelStep } = customer
    if (funnelStep === 'lead' || funnelStep === 'cold') {
        body.funnelStep = 'in-progress'
        body.user = userID
        body.lastActivity = 'взят в работу'
    } else {
        body.lastActivity = 'отредактирован'
    }
    body.lastUpdate = new Date()

    return await Customer.findOneAndUpdate({ _id: customerID }, { $set: body }, { new: true })
}


async function funnel({ userID, today = false }) {
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

    const { account: { _id, funnelSteps } } = await userById({ userID })

    funnelSteps.unshift('in-progress')

    const query = { account: _id, user: userID, funnelStep: { $in: funnelSteps } }
    today && (query['task.when'] = todayRange())
    const customers = await Customer.find(query).lean().exec()

    if (!customers || customers.length === 0) return []

    const listOfCustomers = customers.map(customer => {
        if (!customer.task) {
            customer.task = { what: 'Нет задачи 😡', timestamp: 0 }
            return customer
        }

        customer.task.displayWhen = humanDate(customer.task.when, true) + (customer.task.time ? ` в ${customer.task.time}` : '')
        customer.task.timestamp = convertToTimestamp(customer.task.when, customer.task.time)

        if (today) {
            customer.task.displayWhen = customer.task.timestamp < new Date().getTime() ?
                customer.task.time + ' ⚠️ 🔥 🤬' : customer.task.time
        } else {
            if (customer.task.timestamp < new Date().getTime()) {
                customer.task.displayWhen = customer.task.displayWhen + ' ⚠️ 🔥 🤬'
            } else {
                isToday(customer.task.when) && (customer.task.displayWhen = customer.task.displayWhen + ' 🔔')
            }
        }

        return customer
    })


    return funnelSteps.reduce((result, step) => {
        result.push({
            name: step,
            id: getId(step),
            customers: sortBy(listOfCustomers.filter(customer => customer.funnelStep === step), ({ task: { timestamp } }) => timestamp, ['desc'])
        })
        return result
    }, [])
}


async function stepDown({ userID, customerID }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const { account: { _id, funnelSteps } } = await userById({ userID })

    const customer = await Customer.findOne({
        _id: customerID,
        user: userID,
        account: _id
    }).lean().exec()

    if (!customer) throw new CustomError('Клиент не найден или назначен на другого менеджера', 400)

    funnelSteps.unshift('in-progress')

    const index = funnelSteps.indexOf(customer.funnelStep)

    return await Customer.findOneAndUpdate(
        { _id: customerID },
        { $set: { funnelStep: funnelSteps[index + 1], lastUpdate: new Date(), lastActivity: 'прогресс в воронке' } },
        { new: true })
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

    const { account: { _id, name }, phones } = await userById({ userID })
    const customer = await Customer.findOne({ _id: customerID, account: _id }).populate('trunk').exec()

    if (!customer || customer === null) throw new CustomError('Клиент не найден', 404)

    addLog({
        who: userID, type: 'callback', what: 'запрос на коллбек',
        payload: {}
    })

    // if (customer.user && !customer.user._id.equals(userID)) {
    //     // Сценарий — чужой клиент
    // }

    // if (!customer.user) await Customer.update({ _id: customerID }, { user: userID })

    const options = {
        uri: 'http://185.22.65.50/call.php',
        qs: {
            cn: customer.phones[0].replace('+7', '8'),
            un: phones[0].replace('+7', '8'),
            tr: name === 'Calibry' ? '87780218789' : customer.trunk.phone.replace('+7', '8'),
            call_id: 'ms3'
        },
        headers: { 'User-Agent': 'Request-Promise' },
        json: true
    }

    // await updateLast({ userID, customerID, lastActivity: 'исходящий звонок' })

    const response = await request(options)

    return {
        params: {
            cn: customer.phones[0].replace('+7', '8'),
            un: phones[0].replace('+7', '8'),
            tr: customer.trunk.phone.replace('+7', '8')
        },
        response
    }
}

async function coldCall({ userID, customerID }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const { account: { _id }, phones } = await userById({ userID })
    const customer = await Customer
        .findOne({ _id: customerID, user: userID, account: _id })
        .populate('trunk').exec()

    const options = {
        uri: 'http://185.22.65.50/cold_call.php',
        qs: {
            cn: customer.phones[0].replace('+7', '8'),
            un: phones[0].replace('+7', '8'),
            tr: customer.trunk.phone.replace('+7', '8'),
            call_id: 'cold_call',
            secret_key: '2c22d5c2ed37ea03db53ff931e7a9cf6'
        },
        headers: { 'User-Agent': 'Request-Promise' },
        json: true
    }

    await updateLast({ userID, customerID, lastActivity: 'исходящий звонок' })

    const response = await request(options)

    return {
        params: {
            cn: customer.phones[0].replace('+7', '8'),
            un: phones[0].replace('+7', '8'),
            tr: customer.trunk.phone.replace('+7', '8')
        },
        response
    }
}

async function isCustomerOwner({ userID, customerID }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const customer = await Customer.findOne({ _id: customerID })
        .populate('user').exec()

    if (!customer || customer === null)
        throw new CustomError('Клиент не найден', 404)

    if (!customer.user || customer.user === null)
        throw new CustomError('Клиенту ещё не назначен менеджер', 404)

    if (customer.user && customer.user._id.equals(userID)) return true

    return false
}


module.exports = {
    search,
    leads,
    call,
    coldLeads,
    createColdLead,
    customerById,
    rejectCustomer,
    dealCustomer,
    comeBackCustomer,
    closedCustomers,
    updateCustomer,
    funnel,
    coldCall,
    stepDown,
    recents,
    setTask,
    isCustomerOwner
}