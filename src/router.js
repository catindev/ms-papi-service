const router = require('express').Router()
const { createPassword, verifyPassword } = require('./queries/sessions')
const { search, leads, call, coldLeads, createColdLead, cutomerById, rejectCustomer } = require('./queries/customers')

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
        .then( send => response.status(200).json({ status: 200, send }))
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

    leads({ userID, step:'lead', skip })
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


router.get('/customers', (request, response, next) => {
    // TODO: параметр [ids]. Зачем?
    const { userID, query: { step, searchQuery, options, fields } } = request

    search({ userID, step, searchQuery, options, fields })
        .then(items => response.json({ status: 200, items }))
        .catch(next)
})


router.get('/customers/:customerID', (request, response, next) => {
    const { userID, params: { customerID } } = request

    cutomerById({ userID, customerID })
        .then(customer => response.json({ status: 200, customer }))
        .catch(next)
})

router.put('/customers/:customerID/reject', (request, response, next) => {
    const { userID, params: { customerID }, body: { comment, reason } } = request

    if (!reason) return response.status(400).json({
        status: 400,
        message: 'Заполните причину отказа'
    })

    rejectCustomer({ userID, customerID, comment, reason })
        .then(data => {
            console.log(data)
            response.json({ status: 200 })
        })
        .catch(next)
})


router.get('/customers/funnel', (request, response, next) => {
    const { userID, query: { step = 'lead', skip = 0 } } = request

    search({ userID, step, skip })
        .then(items => response.json({ status: 200, items }))
        .catch(next)
})

router.get('/customers/:customerID/call', (request, response, next) => {
    const { userID, params: { customerID } } = request

    call({ userID, customerID })
        .then(result => {
            result === '{ success: true }'? 
                response.json({ status: 200 })
                :
                response.status(500).json({ status: 500, message: 'Отмена звонка' })
        })
        .catch(next)
})


router.all('*', (request, response) => response.status(404).json({
    status: 404,
    message: 'Здесь ничего нет'
}))

module.exports = router