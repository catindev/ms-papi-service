const router = require('express').Router()
const { createPassword, verifyPassword, findOneSession, SignOut, getTokenOwner } = require('./queries/sessions')
const { addLog, getLog, cleanLog } = require('./queries/logs')
const { createBreadcrumb, getBreadcrumbs, updateBreadcrumb, removeBreadcrumb } = require('./queries/breadcrumbs')
const {
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
} = require('./queries/customers')
const { getLeadsStats, getTrunks } = require('./queries/trunks')
const {
    managersLeads, statsClosed, statsInProgress,
    customerPortrait, statsLeadsFromTrunks, fuckedLeads,
    incomingCallsStats, funnelAll, statsLeadsFromTrunks2,
    rejectCustomersForStats, dealCustomersForStats, badLeadsProfilesForStats,
    qeuedLeadsForStats,
    usersStats, customersByUsers,
    getCallsStatsFromATS
} = require('./queries/stats')
const { allAccounts } = require('./queries/accounts')
const { userById, getUsers } = require('./queries/users')
const { recentCalls } = require('./queries/calls')
const {
    createContact, getContacts, getContact, removeContact,
    updateContact, callbackToContact
} = require('./queries/contacts')

const humanDate = require('./utils/humanDate')

router.get('/', (request, response) => response.json({
    name: 'ms-papi-service',
    version: 1
}))

router.post('/sessions/password', (request, response, next) => {
    const { phone } = request.body

    if (!phone) return response.status(400).json({
        status: 400,
        message: 'Введите номер телефона'
    })

    createPassword({ phone })
        .then(send => {
            console.log('SMSC', phone, send)
            response.status(200).json({ status: 200, send })
        })
        .catch(next)
})

// Magix! //
router.get('/sessions/find.one', (request, response, next) => {
    const { query: { account } } = request
    findOneSession({ account })
        .then(token => {
            console.log(token)
            response.json({ status: 200, token })
        })
        .catch(next)
})

router.get('/users/me', (request, response, next) => {
    const { userID } = request

    userById({ userID })
        .then(user => response.status(200).json({ status: 200, user }))
        .catch(next)
})

router.get('/users', (request, response, next) => {
    const { userID } = request

    getUsers({ userID })
        .then(items => response.status(200).json({ status: 200, items }))
        .catch(next)
})


router.get('/accounts', (request, response, next) => {
    allAccounts()
        .then(items => response.json({ status: 200, items }))
        .catch(next)
})


router.post('/sessions', (request, response, next) => {
    const { code } = request.body

    if (!code) return response.status(400).json({
        message: 'Введите пароль из CMC'
    })

    verifyPassword({ code })
        .then(token => response.status(200).json({ status: 200, token }))
        .catch(next)
})

router.get('/customers/leads', (request, response, next) => {
    const { userID, query: { skip } } = request

    leads({ userID, step: 'lead', skip })
        .then(items => response.json({ status: 200, items }))
        .catch(next)
})

router.get('/customers/cold.leads', (request, response, next) => {
    const { userID, query: { skip } } = request

    coldLeads({ userID, skip })
        .then(items => response.json({ status: 200, items }))
        .catch(next)
})

router.post('/customers/cold.leads', (request, response, next) => {
    const { userID, body } = request

    createColdLead({ userID, data: body })
        .then(lead => response.json({ status: 200, id: lead._id }))
        .catch(next)
})

router.get('/customers/recents', (request, response, next) => {
    const { userID } = request

    recents({ userID })
        .then(items => response.json({ status: 200, items }))
        .catch(next)
})

router.get('/recent.calls', (request, response, next) => {
    const { userID, query: { fromDate } } = request

    recentCalls({ userID, fromDate })
        .then(items => response.json({ status: 200, items }))
        .catch(next)
})


router.get('/customers', (request, response, next) => {
    // TODO: параметр [ids]. Зачем?
    const { userID, query: { step, searchQuery, options, fields } } = request

    search({ userID, step, searchQuery, options, fields })
        .then(items => response.json({ status: 200, items }))
        .catch(next)
})


router.put('/customers/:customerID/reject', (request, response, next) => {
    const { userID, params: { customerID }, body: { comment, reason, name } } = request

    if (!reason) return response.status(400).json({
        status: 400,
        message: 'Заполните причину отказа'
    })

    rejectCustomer({ userID, customerID, comment, reason, name })
        .then(() => response.json({ status: 200 }))
        .catch(next)
})


router.put('/customers/:customerID/deal', (request, response, next) => {
    const { userID, params: { customerID }, body: { comment, amount } } = request

    if (!amount) return response.status(400).json({
        status: 400,
        message: 'Заполните сумму сделки'
    })

    dealCustomer({ userID, customerID, comment, amount })
        .then(() => response.json({ status: 200 }))
        .catch(next)
})

router.put('/customers/:customerID/comeback', (request, response, next) => {
    const { userID, params: { customerID } } = request

    comeBackCustomer({ userID, customerID })
        .then(() => response.json({ status: 200 }))
        .catch(next)
})

router.get('/customers/closed', (request, response, next) => {
    const { userID, query: { filter, skip } } = request

    closedCustomers({ userID, filter })
        .then(({ reject, deal }) => response.json({ status: 200, reject, deal }))
        .catch(next)
})


router.get('/customers/funnel', (request, response, next) => {
    const { userID, query: { step = 'lead', skip = 0, today } } = request

    funnel({ userID, today, step, skip })
        .then(items => response.json({ status: 200, items }))
        .catch(next)
})

router.put('/customers/:customerID/step.down', (request, response, next) => {
    const { userID, params: { customerID } } = request

    stepDown({ userID, customerID })
        .then(customer => response.json({ status: 200, customer }))
        .catch(next)
})

router.put('/customers/:customerID/set.task', (request, response, next) => {
    const { userID, params: { customerID }, body: { when, what, time } } = request

    setTask({ userID, customerID, when, what, time })
        .then(customer => response.json({ status: 200, customer }))
        .catch(next)
})

router.get('/customers/:customerID/call', (request, resp, next) => {
    const { userID, params: { customerID }, query: { client_timestamp } } = request

    console.log(':D Callback to ', customerID, 'from', userID, 'at', client_timestamp);

    addLog({
        who: userID, type: 'callback', what: 'запрос на коллбек',
        payload: `ObjectId("${customerID}"), client_timestamp=${client_timestamp}`
    })

    call({ userID, customerID })
        .then(({ params, response }) => {
            addLog({
                who: userID, type: 'callback', what: 'исходящий звонок',
                payload: { params, response, client_timestamp }
            })
            response === '{ success: true }' ?
                resp.json({ status: 200 }) :
                resp.status(500).json({ status: 500, message: 'Отмена звонка' })
        })
        .catch(next)
})


router.get('/customers/:customerID/cold.call', (request, resp, next) => {
    const { userID, params: { customerID }, query: { client_timestamp } } = request

    console.log(':D Coldback to ', customerID, 'from', userID, 'at', client_timestamp);
    addLog({
        who: userID, type: 'callback', what: 'запрос на холодный коллбек',
        payload: `ObjectId("${customerID}"), client_timestamp=${client_timestamp}`
    })

    coldCall({ userID, customerID })
        .then(({ params, response }) => {
            addLog({
                who: userID, type: 'callback', what: 'холодный звонок',
                payload: { client_timestamp, params, response }
            })
            response === '{ success: true }' ?
                resp.json({ status: 200 }) :
                resp.status(200).json({ status: 200, message: 'Отмена звонка' })
        })
        .catch(next)
})

router.get('/customers/:customerID/isowner', (request, response, next) => {
    const { userID, params: { customerID } } = request

    isCustomerOwner({ userID, customerID })
        .then(isOwner => response.json({ status: 200, isOwner }))
        .catch(next)
})


router.get('/customers/:customerID', (request, response, next) => {
    const { userID, params: { customerID }, query: { params } } = request

    customerById({ userID, customerID, params })
        .then(customer => response.json({ status: 200, customer }))
        .catch(next)
})

router.put('/customers/:customerID', (request, response, next) => {
    const { userID, params: { customerID }, body } = request

    updateCustomer({ userID, customerID, body })
        .then(customer => response.json({ status: 200, customer }))
        .catch(next)
})

/* Breadcrumbs */

router.post('/customers/:customerID/breadcrumbs', (request, response, next) => {
    const { userID, params: { customerID }, query: { df }, body } = request

    createBreadcrumb({ userID, customerID, data: body })
        .then(b => {
            const breadcrumb = JSON.parse(JSON.stringify(b))
            delete breadcrumb.user.password
            delete breadcrumb.user.__v

            // 🤔 💩
            if (df && df === 'human') breadcrumb.date = humanDate(breadcrumb.date)

            response.json({ status: 200, breadcrumb })
        })
        .catch(next)
})

router.get('/customers/:customerID/breadcrumbs', (request, response, next) => {
    const { userID, params: { customerID } } = request

    getBreadcrumbs({ userID, customerID })
        .then(items => {
            items = items.map(item => {
                if (!item.user) return item

                delete item.user.password
                delete item.user.__v

                return item
            })
            response.json({ status: 200, items })
        })
        .catch(next)
})

router.put('/breadcrumbs/:breadcrumbID', (request, response, next) => {
    const { userID, params: { breadcrumbID }, body } = request

    updateBreadcrumb({ userID, breadcrumbID, data: body })
        .then(breadcrumb => response.json({ status: 200, breadcrumb }))
        .catch(next)
})

router.delete('/breadcrumbs/:breadcrumbID', (request, response, next) => {
    const { userID, params: { breadcrumbID } } = request

    removeBreadcrumb({ userID, breadcrumbID })
        .then(() => response.json({ status: 200 }))
        .catch(next)
})

/* Контакты */
router.get('/customers/:customerID/contacts', (request, response, next) => {
    const { userID, params: { customerID }, query: { populate } } = request

    getContacts({ userID, customerID, populate })
        .then(contacts => response.json({ status: 200, contacts }))
        .catch(next)
})

router.post('/customers/:customerID/contacts', (request, response, next) => {
    const { userID, params: { customerID }, body } = request

    // создаёт контакт. возвращает клиента с контактами        
    createContact({ userID, customerID, data: body })
        .then(customer => response.json({ status: 200, customer }))
        .catch(next)
})

router.get('/contacts/:contactID', (request, response, next) => {
    const { userID, params: { contactID }, query: { populate } } = request

    getContact({ userID, contactID, populate })
        .then(contact => response.json({ status: 200, contact }))
        .catch(next)
})


router.delete('/contacts/:contactID', (request, response, next) => {
    const { userID, params: { contactID } } = request

    removeContact({ userID, contactID })
        .then(() => response.json({ status: 200 }))
        .catch(next)
})

router.put('/contacts/:contactID', (request, response, next) => {
    const { userID, params: { contactID }, body } = request

    updateContact({ userID, contactID, data: body })
        .then(() => response.json({ status: 200 }))
        .catch(next)
})

router.get('/contacts/:contactID/callback', (request, response, next) => {
    const { userID, params: { contactID } } = request

    callbackToContact({ userID, contactID })
        .then(callback => response.json({ status: 200, callback }))
        .catch(next)
})

// журнал звонков в админку
// TODO: выпилить в АПИ админки
router.get('/log', (request, response, next) => {
    getLog({})
        .then(items => response.json({ status: 200, items }))
        .catch(next)
})

router.post('/log/clean', (request, response, next) => {
    cleanLog({})
        .then(() => response.json({ status: 200 }))
        .catch(next)
})

// для фильтров в статистике
router.get('/trunks', (request, response, next) => {
    const { userID } = request
    getTrunks({ userID })
        .then(items => response.json({ status: 200, items }))
        .catch(next)
})

router.get('/stats/calls', (request, response, next) => {
    const { userID, query: { start, end, type } } = request

    getCallsStatsFromATS({ userID, start, end, type })
        .then(items => response.json({ status: 200, items }))
        .catch(next)
})

router.get('/stats/leads', (request, response, next) => {
    const { userID } = request
    managersLeads({ userID })
        .then(stats => response.json({ status: 200, stats }))
        .catch(next)
})

router.get('/stats/closed', (request, response, next) => {
    const { userID, query: { start, end } } = request
    statsClosed({ userID, start, end })
        .then(stats => response.json(Object.assign({ status: 200 }, stats)))
        .catch(next)
})

router.get('/stats/reject/profiles', (request, response, next) => {
    const { userID, query: { start, end, manager, trunk, by_created } } = request

    rejectCustomersForStats({ userID, start, end, manager, trunk, by_created })
        .then(customers => response.json({ status: 200, customers }))
        .catch(next)
})

router.get('/stats/badleads/profiles', (request, response, next) => {
    const { userID, query: { start, end, manager, trunk, by_created } } = request

    badLeadsProfilesForStats({ userID, start, end, manager, trunk, by_created })
        .then(customers => response.json({ status: 200, customers }))
        .catch(next)
})

router.get('/stats/deal/profiles', (request, response, next) => {
    const { userID, query: { start, end, manager, trunk, by_created } } = request

    dealCustomersForStats({ userID, start, end, manager, trunk, by_created })
        .then(customers => response.json({ status: 200, count: customers.length, customers }))
        .catch(next)
})

router.get('/stats/leads/profiles', (request, response, next) => {
    const { userID, query: { start, end, manager, trunk } } = request

    qeuedLeadsForStats({ userID, start, end, manager, trunk })
        .then(customers => response.json({ status: 200, count: customers.length, customers }))
        .catch(next)
})

router.get('/stats/in-progress', (request, response, next) => {
    const { userID } = request
    statsInProgress({ userID })
        .then(stats => response.json(Object.assign({ status: 200 }, stats)))
        .catch(next)
})

router.get('/stats/portrait', (request, response, next) => {
    const { userID, query: { start, end } } = request
    customerPortrait({ userID, start, end })
        .then(portrait => response.json({ status: 200, portrait }))
        .catch(next)
})

router.get('/stats/trunks', (request, response, next) => {
    const { userID, query: { start, end } } = request
    statsLeadsFromTrunks({ userID, start, end })
        .then(stats => response.json({ status: 200, stats }))
        .catch(next)
})

router.get('/v2/stats/trunks', (request, response, next) => {
    const { userID, query: { start, end } } = request
    statsLeadsFromTrunks2({ userID, start, end })
        .then(stats => response.json({ status: 200, stats }))
        .catch(next)
})

router.get('/stats/leads/fucked', (request, response, next) => {
    const { userID, query: { start, end } } = request
    fuckedLeads({ userID })
        .then(stats => response.json(Object.assign({ status: 200 }, stats)))
        .catch(next)
})

router.get('/stats/funnel', (request, response, next) => {
    const { userID, query: { manager, start, end } } = request
    funnelAll({ userID, manager, start, end })
        .then(stats => response.json({ status: 200, stats }))
        .catch(next)
})

router.get('/stats/users', (request, response, next) => {
    const { userID } = request

    customersByUsers({ userID })
        .then(stats => response.status(200).json({ status: 200, stats }))
        .catch(next)
})

router.get('/stats/users/details', (request, response, next) => {
    const { userID, query: { start, end } } = request

    usersStats({ userID, start, end })
        .then(stats => response.status(200).json({ status: 200, stats }))
        .catch(next)
})

router.get('/mlog', (request, response, next) => {
    var fs = require('fs');
    fs.readFile('/var/log/mongodb/mongod.log', { encoding: 'utf-8' }, function (err, data) {
        if (!err) {
            console.log('received data: ' + data);
            response.writeHead(200, { 'Content-Type': 'text/plain' });
            response.write(data);
            response.end();
        } else {
            console.log(err);
        }
    })
})

router.all('*', (request, response) => response.status(404).json({
    status: 404,
    message: 'Здесь ничего нет'
}))

module.exports = router