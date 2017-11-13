const router = require('express').Router()
const { createPassword, verifyPassword } = require('./queries/sessions')
const { addLog, getLog, cleanLog } = require('./queries/logs')
const {
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
    stepDown,
    recents
} = require('./queries/customers')

const { addPhoneNumber, removePhoneNumber, editPhoneNumber } = require('./queries/users')

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
        .then(send => response.status(200).json({ status: 200, send }))
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

router.get('/customers/leads',  (request, response, next) => {
    const { userID, query: { skip } } = request

    leads({ userID, step: 'lead', skip })
        .then(items => response.json({ status: 200, items }))
        .catch(next)
})

router.get('/customers/cold.leads',  (request, response, next) => {
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


router.get('/customers', (request, response, next) => {
    // TODO: параметр [ids]. Зачем?
    const { userID, query: { step, searchQuery, options, fields } } = request

    search({ userID, step, searchQuery, options, fields })
        .then(items => response.json({ status: 200, items }))
        .catch(next)
})


router.put('/customers/:customerID/reject',  (request, response, next) => {
    const { userID, params: { customerID }, body: { comment, reason } } = request

    if (!reason) return response.status(400).json({
        status: 400,
        message: 'Заполните причину отказа'
    })

    rejectCustomer({ userID, customerID, comment, reason })
        .then(() => response.json({ status: 200 }))
        .catch(next)
})


router.put('/customers/:customerID/deal',  (request, response, next) => {
    const { userID, params: { customerID }, body: { comment, amount } } = request

    if (!amount) return response.status(400).json({
        status: 400,
        message: 'Заполните сумму сделки'
    })

    dealCustomer({ userID, customerID, comment, amount })
        .then(() => response.json({ status: 200 }))
        .catch(next)
})


router.get('/customers/closed',  (request, response, next) => {
    const { userID, query: { skip } } = request

    closedCustomers({ userID })
        .then(({ reject, deal }) => response.json({ status: 200, reject, deal }))
        .catch(next)
})


router.get('/customers/funnel', (request, response, next) => {
    const { userID, query: { step = 'lead', skip = 0 } } = request

    funnel({ userID, step, skip })
        .then(items => response.json({ status: 200, items }))
        .catch(next)
})

router.put('/customers/:customerID/step.down', (request, response, next) => {
    const { userID, params: { customerID } } = request

    stepDown({ userID, customerID })
        .then(customer => response.json({ status: 200, customer }))
        .catch(next)
})

router.get('/customers/:customerID/call', (request, resp, next) => {
    const { userID, params: { customerID } } = request

    addLog({ 
        who: userID, type: 'callback', what: 'запрос на коллбек', 
        payload: `ObjectId("${customerID}")` 
    })

    call({ userID, customerID })
        .then(({ params, response }) => {
            addLog({ 
                who: userID, type: 'callback', what: 'исходящий звонок', 
                payload: { params, response } 
            })           
            response === '{ success: true }' ?
                resp.json({ status: 200 }) :
                resp.status(500).json({ status: 500, message: 'Отмена звонка' })
        })
        .catch(next)
})


router.get('/customers/:customerID/cold.call', (request, resp, next) => {
    const { userID, params: { customerID } } = request

    addLog({ 
        who: userID, type: 'callback', what: 'запрос на холодный коллбек', 
        payload: `ObjectId("${customerID}")` 
    })

    coldCall({ userID, customerID })
        .then(({ params, response }) => {
            addLog({ 
                who: userID, type: 'callback', what: 'холодный звонок', 
                payload: { params, response } 
            })
            response === '{ success: true }' ?
                resp.json({ status: 200 }) :
                resp.status(500).json({ status: 500, message: 'Отмена звонка' })
        })
        .catch(next)
})


router.get('/customers/:customerID',  (request, response, next) => {
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

router.all('*', (request, response) => response.status(404).json({
    status: 404,
    message: 'Здесь ничего нет'
}))

module.exports = router