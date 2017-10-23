const router = require('express').Router()
const { SignIn } = require('./queries/sessions')
const { search, leads, call } = require('./queries/customers')

router.get('/', (request, response) => response.json({
    name: 'ms-papi-service',
    version: 1
}))


router.post('/sessions', (request, response, next) => {
    const { login, password } = request.body

    if (!login || !password) return response.status(400).json({
        message: 'Введите логин и пароль'
    })

    SignIn({ login, password })
        .then(token => response.status(200).json({ status: 200, token }))
        .catch(next)
})

router.get('/customers/leads', (request, response, next) => {
    const { userID, query: { skip } } = request

    leads({ userID, step:'lead', skip })
        .then(items => response.json({ status: 200, items }))
        .catch(next)
})


router.get('/customers', (request, response, next) => {
    // TODO: параметр [ids]. Зачем?

    const { userID, query: { step, searchQuery, options, fields } } = request

    console.log(options)
    search({ userID, step, searchQuery, options, fields })
        .then(items => response.json({ status: 200, items }))
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
            console.log(result)
            response.json({ status: 200 })
        })
        .catch(next)
})


router.all('*', (request, response) => response.status(404).json({
    status: 404,
    message: 'Здесь ничего нет'
}))

module.exports = router