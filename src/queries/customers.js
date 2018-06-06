const toObjectId = require('mongoose').Types.ObjectId
const {
    Account,
    Customer,
    Contact,
    Call,
    Trunk,
    Param,
    Log,
    Breadcrumb
} = require('../schema')


const CustomError = require('../utils/error')
const formatNumber = require('../utils/formatNumber')
const formatNumberForHumans = require('../utils/formatNumberForHumans')
const humanDate = require('../utils/humanDate')
const formatDate = require('../utils/formatDate')
const {
    userById
} = require('./users')
const {
    addLog
} = require('./logs')
const request = require('request-promise')
const md5 = require('../utils/md5')
const {
    sortBy
} = require('lodash')
const {
    createContact
} = require('./contacts')
const {
    createBreadcrumb,
    getBreadcrumbs
} = require('./breadcrumbs')

const moment = require('moment')
moment.locale('ru')

async function updateLast({
    userID,
    customerID,
    lastActivity
}) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const {
        account: {
            _id,
            funnelSteps
        }
    } = await userById({
        userID
    })

    return await Customer.findOneAndUpdate({
        _id: customerID,
        user: userID,
        account: _id
    }, {
            $set: {
                lastUpdate: new Date(),
                lastActivity
            }
        }, {
            new: true
        })
}

async function setTask({
    userID,
    customerID,
    when,
    what,
    time = '00:00'
}) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const {
        account: {
            _id
        }
    } = await userById({
        userID
    })

    when = new Date(when)

    await createBreadcrumb({
        userID,
        customerID,
        data: {
            date: new Date(),
            type: 'task',
            comment: what,
            task: {
                when,
                time
            }
        }
    })

    return await Customer.findOneAndUpdate({
        _id: customerID,
        user: userID,
        account: _id
    }, {
            $set: {
                'task.what': what,
                'task.when': when,
                'task.time': time
            }
        }, {
            new: true
        })
}

async function leads({
    userID,
    skip = 0
}) {
    /*
    Лиды: клиенты без менеджера или записанные за текущим менеджером.
    Формат: .....? 
    Нюансы: Без обратной сортировки по дате, чтобы новые были внизу и до них нужно было 
    скроллить — мотив к тому чтобы разгребать кучу в нужном порядке, а не самых свежих. 
    Без пагинации и, возможно, самых новых видно не будет если лидов 100500 с тем же 
    мотивом. 
    */

    if (typeof userID === 'string') userID = toObjectId(userID)

    const {
        account: {
            _id
        }
    } = await userById({
        userID
    })

    const options = {
        skip,
        limit: 50
    }
    const customers = await Customer.find({
        account: _id,
        funnelStep: 'lead',
        '$or': [{
            user: {
                $exists: false
            }
        }, {
            user: userID
        }],
    }).sort('_id').lean().exec()

    if (customers.length === 0) return customers

    const result = []

    for (let customer of customers) {
        const state = !customer.user ? 'WAIT_RECALL' : 'WAIT_PROFILE'
        result.push(Object.assign({}, customer, {
            state
        }))
    }

    return result
}


async function coldLeads({
    userID,
    skip = 0
}) {
    if (typeof userID === 'string') userID = toObjectId(userID)

    const {
        account: {
            _id
        }
    } = await userById({
        userID
    })

    const options = {
        skip,
        limit: 50
    }
    const customers = await Customer.find({
        account: _id,
        funnelStep: 'cold',
        user: userID
    }).sort('_id')

    return customers
}


async function recents({
    userID,
    skip = 0
}) {
    if (typeof userID === 'string') userID = toObjectId(userID)

    const {
        account: {
            _id
        }
    } = await userById({
        userID
    })

    const options = {
        skip,
        limit: 50
    }
    const customers = await Customer
        .find({
            account: _id,
            user: userID,
            funnelStep: {
                $nin: ['lead']
            },
            lastActivity: {
                $exists: true
            }
        })
        .sort('-lastUpdate')

    return customers
}

async function createColdLead({
    userID,
    data
}) {
    if (typeof userID === 'string') userID = toObjectId(userID)

    const {
        account: {
            _id
        }
    } = await userById({
        userID
    })

    data.phones = formatNumber(data.phones)
    const contact = await Contact.findOne({
        account: _id,
        phone: data.phones
    }).populate('customer').exec()

    if (contact) throw new CustomError(`Номер уже сохранён под именем ${contact.name} у клиента ${contact.customer.name}`, 400)

    const trunk = await Trunk.findOne({
        account: _id,
        active: true,
        name: 'Холодные звонки'
    })
    if (!trunk || trunk === null)
        throw new CustomError('Не могу добавить клиента. Нет источников для холодного обзвона. Напишите об этой ошибке в поддержку', 404)

    const newCustomer = new Customer(Object.assign({}, data, {
        account: _id,
        user: userID,
        funnelStep: 'cold',
        trunk: trunk._id,
        contacts: []
    }))
    const createdLead = await newCustomer.save()

    await createBreadcrumb({
        userID,
        customerID: createdLead._id,
        data: {
            date: new Date(),
            type: 'created'
        }
    })

    return await createContact({
        userID,
        customerID: createdLead._id,
        data: {
            name: 'Основной',
            phone: createdLead.phones[0],
        }
    })
}


async function customerById({
    userID,
    customerID,
    params = false
}) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const user = await userById({
        userID
    })
    const {
        account: {
            _id
        }
    } = user

    let customer = await Customer.findOne({
        account: _id,
        _id: customerID
    })
        .populate('account trunk user').exec()

    if (!customer)
        throw new CustomError('Клиент не найден. Напишите об этой ошибке в поддержку', 404)

    if (customer.user && !customer.user._id.equals(userID)) {
        // throw new CustomError('Клиент назначен на другого менеджера', 404)
    }

    customer = customer.toObject()
    customer.phones = customer.phones.map(formatNumberForHumans)

    if (customer.task) {
        customer.task.displayWhen = humanDate(customer.task.when, true)
        customer.task.when = formatDate(customer.task.when, 'YYYY-MM-DD')
    }

    const calls = await Call.find({
        customer: customerID,
        account: _id
    }).sort('-_id').lean().exec()

    if (calls.length > 0) {
        customer = Object.assign({}, customer, {
            calls
        })
        customer.calls = customer.calls.map(call => {
            const clone = Object.assign({}, call)
            clone.date = humanDate(clone.date)
            return clone
        })
    }

    if (params) {
        const params = await Param.find({
            account: _id
        }).lean().exec()
        if (params) customer = Object.assign({}, customer, {
            params
        })
    }

    // getBreadcrumbs
    const breadcrumbs = await getBreadcrumbs({
        userID,
        customerID
    })
    if (breadcrumbs.length > 0) {
        customer = Object.assign({}, customer, {
            breadcrumbs
        })
        customer.breadcrumbs = customer.breadcrumbs.map(b => {
            const clone = JSON.parse(JSON.stringify(b))
            clone.display = {
                date: humanDate(clone.date),
                dateFromNow: moment(clone.date).fromNow()
            }
            clone.date = humanDate(clone.date)
            if (clone.type === 'call' || clone.type === 'callback')
                clone.call.date = humanDate(clone.call.date)
            if (clone.type === 'task') clone.task.when = humanDate(clone.task.when, true)
            return clone
        })
    } else {
        customer = Object.assign({}, customer, {
            breadcrumbs: []
        })
    }

    return customer
}

async function rejectCustomer({
    userID,
    customerID,
    reason,
    comment = '',
    name = false
}) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const {
        account: {
            _id
        }
    } = await userById({
        userID
    })

    const customer = await Customer.findOne({
        _id: customerID,
        account: _id
    }).lean().exec()

    if (!customer) throw new CustomError('Клиент не найден. Напишите об этой ошибке в поддержку', 400)

    const {
        funnelStep,
        user
    } = customer
    const query = {
        $set: {
            funnelStep: 'reject',
            lastUpdate: new Date(),
            reject: {
                reason,
                comment,
                previousStep: funnelStep,
                date: new Date()
            },
            user: user ? user : userID
        }
    }

    if (name) query.$set.name = name

    await createBreadcrumb({
        userID,
        customerID: customer._id,
        data: {
            date: new Date(),
            type: 'reject',
            reason,
            comment,
            previousStep: funnelStep
        }
    })

    return await Customer.findOneAndUpdate({
        _id: customerID,
        account: _id
    }, query, {
            new: true
        })
}


async function dealCustomer({
    userID,
    customerID,
    amount,
    comment = ''
}) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const {
        account: {
            _id
        }
    } = await userById({
        userID
    })

    const customer = await Customer.findOne({
        _id: customerID,
        account: _id,
        user: userID
    }).lean().exec()

    if (!customer) throw new CustomError('Клиент не найден. Напишите об этой ошибке в поддержку', 400)

    const {
        funnelStep
    } = customer
    const deal = await Customer.findOneAndUpdate({
        _id: customerID,
        account: _id,
        user: userID
    }, {
            $set: {
                funnelStep: 'deal',
                lastUpdate: new Date(),
                deal: {
                    amount,
                    comment,
                    previousStep: funnelStep,
                    date: new Date()
                },
            }
        }, {
            new: true
        })

    await createBreadcrumb({
        userID,
        customerID,
        data: {
            date: new Date(),
            type: 'deal',
            amount,
            comment,
            previousStep: funnelStep
        }
    })

    return deal
}


async function closedCustomers({
    userID,
    filter = 'all'
}) {
    if (typeof userID === 'string') userID = toObjectId(userID)

    const {
        account: {
            _id
        }
    } = await userById({
        userID
    })
    const query = {
        account: _id,
        user: userID
    }

    if (filter === 'all') query.$or = [{
        funnelStep: 'reject'
    }, {
        funnelStep: 'deal'
    }]
    if (filter === 'reject') query.funnelStep = 'reject'
    if (filter === 'deal') query.funnelStep = 'deal'

    const customers = await Customer.find(query).lean().exec()

    const reject = customers.filter(customer => customer.funnelStep === 'reject')
    const deal = customers.filter(customer => customer.funnelStep === 'deal')

    return {
        reject,
        deal
    }
}

async function comeBackCustomer({
    userID,
    customerID
}) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const {
        account: {
            _id
        }
    } = await userById({
        userID
    })

    const customer = await Customer.findOne({
        _id: customerID,
        account: _id
    }).lean().exec()

    if (!customer) throw new CustomError('Клиент не найден', 400)

    const reopened = await Customer.findOneAndUpdate({
        _id: customerID,
        account: _id
    }, {
            $set: {
                funnelStep: 'in-progress',
                lastUpdate: new Date()
            }
        }, {
            new: true
        })

    await createBreadcrumb({
        userID,
        customerID,
        data: {
            date: new Date(),
            type: 'reopen'
        }
    })

    return reopened
}

async function updateCustomer({
    userID,
    customerID,
    body
}) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const {
        account: {
            _id
        }
    } = await userById({
        userID
    })

    const customer = await Customer.findOne({
        _id: customerID,
        account: _id
    }).lean().exec()
    if (!customer) throw new CustomError('Клиент не найден или назначен на другого менеджера', 400)

    const {
        funnelStep
    } = customer

    if (funnelStep === 'lead' || funnelStep === 'cold') {
        body.funnelStep = 'in-progress'
        body.user = userID

        await createBreadcrumb({
            userID,
            customerID,
            data: {
                date: new Date(),
                type: 'in-progress',
                payload: body
            }
        })
    }

    return await Customer.findOneAndUpdate({
        _id: customerID
    }, {
            $set: body
        }, {
            new: true
        })
}


// TODO: куча треша с эмоджи в описаниях задачи и прочим
// Оставляю пока так в надежде, что выпилим воронку к хуям
async function funnel({
    userID,
    today = false
}) {
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

    const {
        account: {
            _id,
            funnelSteps
        }
    } = await userById({
        userID
    })

    funnelSteps.unshift('in-progress')

    const query = {
        account: _id,
        user: userID,
        funnelStep: {
            $in: funnelSteps
        }
    }
    today && (query['task.when'] = todayRange())
    const customers = await Customer.find(query).lean().exec()

    if (!customers || customers.length === 0) return []

    const listOfCustomers = customers.map(customer => {
        if (!customer.task) {
            customer.task = {
                what: 'Нет задачи 😡',
                timestamp: 0
            }
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
            customers: sortBy(listOfCustomers.filter(customer => customer.funnelStep === step), ({
                task: {
                    timestamp
                }
            }) => timestamp, ['desc'])
        })
        return result
    }, [])
}


async function stepDown({
    userID,
    customerID
}) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const {
        account: {
            _id,
            funnelSteps
        }
    } = await userById({
        userID
    })

    const customer = await Customer.findOne({
        _id: customerID,
        user: userID,
        account: _id
    }).lean().exec()

    if (!customer) throw new CustomError('Клиент не найден или назначен на другого менеджера', 400)

    funnelSteps.unshift('in-progress')

    const index = funnelSteps.indexOf(customer.funnelStep)

    return await Customer.findOneAndUpdate({
        _id: customerID
    }, {
            $set: {
                funnelStep: funnelSteps[index + 1],
                lastUpdate: new Date(),
                lastActivity: 'прогресс в воронке'
            }
        }, {
            new: true
        })
}


async function search({
    userID,
    step,
    searchQuery = 'undefined',
    options = {},
    fields = null
}) {

    function getURL({
        funnelStep,
        _id
    }) {
        const prefix = 'new'
        if (funnelStep === 'lead') return `http://${prefix}.mindsales-crm.com/leads/hot/${_id}?pm_source=from_search`
        if (funnelStep === 'cold') return `http://${prefix}.mindsales-crm.com/leads/cold/${_id}?pm_source=from_search`
        if (funnelStep === 'reject' || funnelStep === 'deal') return `http://${prefix}.mindsales-crm.com/closed/${_id}?pm_source=from_search`
        return `http://${prefix}.mindsales-crm.com/customers/${_id}?pm_source=from_search`
    }

    if (typeof userID === 'string') userID = toObjectId(userID)

    if (step && searchQuery === 'undefined') searchQuery = ''

    const searchOptions = [{
        name: {
            '$regex': searchQuery,
            '$options': 'i'
        }
    },
    {
        phone: {
            '$regex': searchQuery.replace(/\D/g, ''),
            '$options': 'i'
        }
    }
    ]

    const {
        account: {
            _id
        }
    } = await userById({
        userID
    }, options)

    const query = {
        account: _id,
        '$or': [{
            user: {
                $exists: false
            }
        }, {
            user: userID
        }],
    }

    if (step) query.funnelStep = step
    if (searchQuery) query.$or = Object.assign(query.$or, searchOptions)

    const skip = options.skip ? parseInt(options.skip) : 0
    const limit = options.limit ? parseInt(options.limit) : 10

    const contacts = await Contact.find(query, fields, {
        skip,
        limit
    }).populate('customer').exec()

    return contacts.map(contact => ({
        name: contact.customer.name,
        phone: contact.phone,
        url: getURL(contact.customer)
    }))
}


async function call({
    userID,
    customerID
}) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const {
        account: {
            _id,
            name
        },
        phones
    } = await userById({
        userID
    })
    const customer = await Customer.findOne({
        _id: customerID,
        account: _id
    }).populate('trunk').exec()

    if (!customer || customer === null) throw new CustomError('Клиент не найден', 404)

    // if (customer.user && !customer.user._id.equals(userID)) {
    //     // Сценарий — чужой клиент
    // }

    // if (!customer.user) await Customer.update({ _id: customerID }, { user: userID })

    const requestTimestamp = new Date().getTime();

    const qs = {
        cn: customer.phones[0].replace('+7', '8'),
        un: phones[0].replace('+7', '8'),
        tr: name === 'Calibry' ? '87780218789' : customer.trunk.phone.replace('+7', '8'),
        call_id: 'ms3'
    }

    const options = {
        uri: 'http://185.22.65.50/call.php',
        qs,
        headers: {
            'User-Agent': 'Mindsales-CRM'
        },
        json: true
    }

    const response = await request(options)

    addLog({
        who: userID,
        type: 'callback',
        what: 'запрос на коллбек',
        payload: {
            qs,
            response,
            requestTimestamp
        }
    })

    return {
        params: {
            cn: customer.phones[0].replace('+7', '8'),
            un: phones[0].replace('+7', '8'),
            tr: customer.trunk.phone.replace('+7', '8')
        },
        response,
        requestTimestamp
    }
}

async function coldCall({
    userID,
    customerID
}) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const {
        account: {
            _id
        },
        phones
    } = await userById({
        userID
    })
    const customer = await Customer
        .findOne({
            _id: customerID,
            user: userID,
            account: _id
        })
        .populate('trunk').exec()

    const coldTrunk = await Trunk.findOne({
        account: _id,
        active: true,
        name: 'Холодные звонки'
    })

    if (!coldTrunk || coldTrunk === null)
        throw new CustomError('Не найден источник для холодных лидов', 404)

    const requestTimestamp = new Date().getTime();

    const qs = {
        cn: customer.phones[0].replace('+7', '8'),
        un: phones[0].replace('+7', '8'),
        tr: coldTrunk.phone.replace('+7', '8'),
        call_id: 'cold_call',
        secret_key: '2c22d5c2ed37ea03db53ff931e7a9cf6',
        request_timestamp: requestTimestamp
    }

    const options = {
        uri: 'http://185.22.65.50/cold_call.php',
        qs,
        headers: {
            'User-Agent': 'Request-Promise'
        },
        json: true
    }

    const response = await request(options)

    addLog({
        who: userID,
        type: 'callback',
        what: 'запрос на хол. коллбек',
        payload: {
            qs,
            response,
            requestTimestamp
        }
    })

    return {
        params: qs,
        response,
        requestTimestamp
    }
}

async function isCustomerOwner({
    userID,
    customerID
}) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const customer = await Customer.findOne({
        _id: customerID
    })
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