const toObjectId = require('mongoose').Types.ObjectId
const { Account, Customer, Call, Trunk, Param } = require('../schema')
const CustomError = require('../utils/error')
const formatNumber = require('../utils/formatNumber')
const formatNumberForHumans = require('../utils/formatNumberForHumans')
const humanDate = require('../utils/humanDate')
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

    const options = { skip, limit: 50 }
    const customers = await Customer.find({
        account: _id,
        funnelStep: 'lead',
        '$or': [{ user: { $exists: false } }, { user: userID }],
    })

    if (customers.length === 0) return customers

    const result = []

    for (let customer of customers) {
        const call = await Call.findOne({ customer: customer._id }).sort('-_id')
        const state = !call || !call.record ? 'WAIT_RECALL' : 'WAIT_PROFILE'
        result.push(Object.assign({}, customer.toObject(), { state }))
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
    })

    return customers
}


async function createColdLead({ userID, data }) {
    // TODO: проверять по номеру не зареган ли такой лид уже

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
        trunk: trunk._id
    }))

    return await newCustomer.save()
}


async function customerById({ userID, customerID, params = false }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const user = await userById({ userID })
    const { account: { _id } } = user

    let customer = await Customer.findOne({ account: _id, _id: customerID })
        .populate('account trunk user').exec()

    if (!customer) throw new CustomError('Клиент не найден', 404)

    if (customer.user && !customer.user._id.equals(userID))
        throw new CustomError('Чужой клиент', 400)

    if (!customer.user) {
        await Customer.update({ _id: customerID }, { user: userID })
        customer.user = user
    }

    customer = customer.toObject()

    customer.phones = customer.phones.map(formatNumberForHumans)

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

async function rejectCustomer({ userID, customerID, reason, comment = '' }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const { account: { _id } } = await userById({ userID })

    const customer = await Customer.findOne({ _id: customerID, account: _id }).lean().exec()

    if (!customer) throw new CustomError('Клиент не найден', 400)

    const { funnelStep } = customer

    return await Customer.findOneAndUpdate({ _id: customerID, account: _id }, {
        $set: {
            funnelStep: 'reject',
            reject: {
                reason,
                comment,
                previousStep: funnelStep,
                date: new Date()
            },
        }
    }, { new: true })
}


async function dealCustomer({ userID, customerID, amount, comment = '' }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const { account: { _id } } = await userById({ userID })

    const customer = await Customer.findOne({ _id: customerID, account: _id }).lean().exec()

    if (!customer) throw new CustomError('Клиент не найден', 400)

    const { funnelStep } = customer

    return await Customer.findOneAndUpdate({ _id: customerID, account: _id }, {
        $set: {
            funnelStep: 'deal',
            deal: {
                amount,
                comment,
                previousStep: funnelStep,
                date: new Date()
            },
        }
    }, { new: true })
}


async function closedCustomers({ userID }) {
    if (typeof userID === 'string') userID = toObjectId(userID)

    const { account: { _id } } = await userById({ userID })

    const customers = await Customer.find({
        account: _id,
        $or: [{ funnelStep: 'reject' }, { funnelStep: 'deal' }]
    }).lean().exec()

    const reject = customers.filter(customer => customer.funnelStep === 'reject')
    const deal = customers.filter(customer => customer.funnelStep === 'deal')

    return { reject, deal }

}

async function updateCustomer({ userID, customerID, body }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const { account: { _id } } = await userById({ userID })

    const customer = await Customer.findOne({ _id: customerID, user: userID, account: _id }).lean().exec()
    if (!customer) throw new CustomError('Клиент не найден или назначен на другого менеджера', 400)

    const { funnelStep } = customer
    if (funnelStep === 'lead' || 'cold') body.funnelStep = 'in-progress'

    return await Customer.findOneAndUpdate({ _id: customerID }, { $set: body }, { new: true })
}


async function funnel({ userID }) {
    if (typeof userID === 'string') userID = toObjectId(userID)

    const { account: { _id, funnelSteps } } = await userById({ userID })

    funnelSteps.unshift('in-progress')

    const query = { account: _id, user: userID, funnelStep: { $in: funnelSteps } }
    const customers = await Customer.find(query)

    if (!customers || customers.length === 0) return []

    return funnelSteps.reduce((result, step) => {
        result.push({
            name: step,
            customers: customers
                .filter(customer => customer.funnelStep === step)
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

    return await Customer.findOneAndUpdate({ _id: customerID }, { $set: { funnelStep: funnelSteps[index + 1] } }, { new: true })
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

async function coldCall({ userID, customerID }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const { account: { _id }, phones } = await userById({ userID })
    const customer = await Customer.findOne({ _id: customerID, account: _id }).populate('trunk').exec()

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

    return await request(options)
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
    closedCustomers,
    updateCustomer,
    funnel,
    coldCall,
    stepDown
}