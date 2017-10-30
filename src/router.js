const router = require('express').Router()
const { createPassword, verifyPassword } = require('./queries/sessions')
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
    stepDown
} = require('./queries/customers')

const mcache = require('memory-cache')
const cache = (duration) => {
    return (request, response, next) => {
        let key = '__express__' + request.originalUrl || request.url
        let cachedBody = mcache.get(key)
        if (cachedBody) {
            response.send(cachedBody)
            return
        } else {
            response.sendResponse = response.send
            response.send = (body) => {
                mcache.put(key, body, duration * 1000)
                response.sendResponse(body)
            }
            next()
        }
    }
}


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

router.get('/customers/leads', cache(10), (request, response, next) => {
    const { userID, query: { skip } } = request

    leads({ userID, step: 'lead', skip })
        .then(items => response.json({ status: 200, items }))
        .catch(next)
})

router.get('/customers/cold.leads', cache(10), (request, response, next) => {
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


router.get('/customers', (request, response, next) => {
    // TODO: параметр [ids]. Зачем?
    const { userID, query: { step, searchQuery, options, fields } } = request

    search({ userID, step, searchQuery, options, fields })
        .then(items => response.json({ status: 200, items }))
        .catch(next)
})


router.put('/customers/:customerID/reject', cache(10), (request, response, next) => {
    const { userID, params: { customerID }, body: { comment, reason } } = request

    if (!reason) return response.status(400).json({
        status: 400,
        message: 'Заполните причину отказа'
    })

    rejectCustomer({ userID, customerID, comment, reason })
        .then(() => response.json({ status: 200 }))
        .catch(next)
})


router.put('/customers/:customerID/deal', cache(10), (request, response, next) => {
    const { userID, params: { customerID }, body: { comment, amount } } = request

    if (!amount) return response.status(400).json({
        status: 400,
        message: 'Заполните сумму сделки'
    })

    dealCustomer({ userID, customerID, comment, amount })
        .then(() => response.json({ status: 200 }))
        .catch(next)
})


router.get('/customers/closed', cache(10), (request, response, next) => {
    const { userID, query: { skip } } = request

    closedCustomers({ userID })
        .then(({ reject, deal }) => response.json({ status: 200, reject, deal }))
        .catch(next)
})


router.get('/customers/funnel', cache(10), (request, response, next) => {
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

router.get('/customers/:customerID/call', (request, response, next) => {
    const { userID, params: { customerID } } = request

    call({ userID, customerID })
        .then(result => {
            console.log('callback', result)
            result === '{ success: true }' ?
                response.json({ status: 200 }) :
                response.status(500).json({ status: 500, message: 'Отмена звонка' })
        })
        .catch(next)
})


router.get('/customers/:customerID/cold.call', (request, response, next) => {
    const { userID, params: { customerID } } = request

    coldCall({ userID, customerID })
        .then(result => {
            console.log('cold call', result)
            result === '{ success: true }' ?
                response.json({ status: 200 }) :
                response.status(500).json({ status: 500, message: 'Отмена звонка' })
        })
        .catch(next)
})


router.get('/customers/:customerID', cache(10), (request, response, next) => {
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

router.all('*', (request, response) => response.status(404).json({
    status: 404,
    message: 'Здесь ничего нет'
}))

module.exports = router