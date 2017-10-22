const router = require('express').Router()
const { getTokenOwner, SignIn } = require('./queries/sessions')
const { createAccount, allAccounts, accountById, updateAccount } = require('./queries/accounts')
const { createUser, userById, allUsers, updateUser, resetPassword } = require('./queries/users')
const { createTrunk, allTrunks, updateTrunk } = require('./queries/trunks')
const { createParam, paramById, allParams, updateParam } = require('./queries/params')

// TODO: страничка с доками для авторизованного админа
router.get('/', (request, response) => response.json({
    name: 'api-service',
    version: 1
}))

router.post('/sessions', (request, response, next) => {
    const { login, password } = request.body

    if (!login || !password) return response.status(400).json({
        message: 'Введите логин и пароль'
    })

    SignIn({ login, password })
        .then(token => response.json({ status: 200, token }))
        .catch(next)
})

router.get('/sessions', (request, response, next) => {
    const { session_token } = request.query
     
    getTokenOwner({ token: session_token })
        .then(user => {
            const id = user._id
            delete user._id
            response.json(Object.assign({ status: 200, id }, user))
        })
        .catch(next)
})

router.post('/accounts', (request, response, next) => {
    const { name } = request.body
    const author = request.adminID

    createAccount({ name, author })
        .then(({ _id }) => response.json({ status: 200, id: _id }))
        .catch(next)
})

router.get('/accounts',  (request, response, next) => {
    const { adminID } = request

    allAccounts({ adminID })
        .then((items = []) => response.json({ 
            status: 200, 
            items: items.map(({ _id, name }) => ({ id: _id, name })) 
        }))
        .catch(next)
})

router.get('/accounts/:accountID',  (request, response, next) => {
    const { adminID, params: { accountID } } = request

    const moment = require('moment')
    moment.locale('ru')

    accountById({ adminID, accountID })
        .then(account => {
            if (account === null) return response
                .status(404)
                .json({ status: 404, message: 'Аккаунт не найден' })

            const acc = account.toJSON()
            const id = acc._id
            delete acc._id

            acc.author = acc.author.login
            acc.created = moment(acc.created).format('DD MMMM')

            response.json(Object.assign({ status: 200, id }, acc))
        })
        .catch(next)
})

router.put('/accounts/:accountID',  (request, response, next) => {
    const { body, adminID, params: { accountID } } = request

    updateAccount({ adminID, accountID, data: body })
        .then(() => response.json({ status: 200 }))
        .catch(next)
})

router.post('/accounts/:accountID/users',  (request, response, next) => {
    const { adminID, body: { name }, params: { accountID } } = request

    createUser({ name, adminID, accountID })
        .then(({ _id }) => response.json({ status: 200, id: _id }))
        .catch(next)
})

router.get('/accounts/:accountID/users',  (request, response, next) => {
    const { adminID, params: { accountID, userID } } = request

    allUsers({ adminID, userID, accountID })
        .then(items => response.json({ 
            status: 200, 
            items: items ? 
                items.map(({ _id, name }) => ({ id: _id, name })) 
                :
                []
        }))
        .catch(next)
})

router.get('/accounts/:accountID/users/:userID',  (request, response, next) => {
    const { adminID, params: { accountID, userID } } = request

    userById({ adminID, userID, accountID })
        .then(user => {
            if (user === null) return response
                .status(404)
                .json({ status: 404, message: 'Учётная запись не найдена' })

            const usr = user.toJSON()
            const id = usr._id
            delete usr._id

            response.json(Object.assign({ status: 200, id }, usr))
        })
        .catch(next)
})

router.put('/accounts/:accountID/users/:userID',  (request, response, next) => {
    const { adminID, params: { accountID, userID } } = request

    updateUser({ adminID, userID, accountID, data: request.body })
        .then(() => response.json({ status: 200 }))
        .catch(next)
})

router.put('/accounts/:accountID/users/:userID/reset.password',  (request, response, next) => {
    const { adminID, params: { accountID, userID } } = request

    resetPassword({ adminID, userID, accountID })
        .then( password => response.json({ status: 200, password }))
        .catch(next)
})

router.post('/accounts/:accountID/trunks',  (request, response, next) => {
    const { adminID, params: { accountID }, body: { name, phone} } = request

    if (!name) return response.status(400).json({
        status:400,
        message: "Не заполнено название транка",
        fields: [ "name" ]
    })

    if (!phone) return response.status(400).json({
        status:400,
        message: "Не заполнен номер транка",
        fields: [ "phone" ]
    })

    createTrunk({ name, phone, adminID, accountID })
        .then(({ _id }) => response.json({ status: 200, id: _id }))
        .catch(next)
})

router.get('/accounts/:accountID/trunks',  (request, response, next) => {
    const { adminID, params: { accountID } } = request

    allTrunks({ adminID, accountID })
        .then((items = []) => response.json({ 
            status: 200, 
            items: items ? 
                items.map(({ _id, name, phone, active }) => ({ id: _id, name, phone, active })) 
                :
                []
        }))
        .catch(next)
})

router.put('/accounts/:accountID/trunks/:trunkID',  (request, response, next) => {
    const { adminID, body, params: { accountID, trunkID } } = request

    updateTrunk({ adminID, trunkID, accountID, data: body })
        .then(() => response.json({ status: 200 }))
        .catch(next)
})

router.post('/accounts/:accountID/params',  (request, response, next) => {
    const { adminID, params: { accountID }, body: { name } } = request

    createParam({ name, adminID, accountID })
        .then(({ _id }) => response.json({ status: 200, id: _id }))
        .catch(next)
})

router.get('/accounts/:accountID/params',  (request, response, next) => {
    const { adminID, params: { accountID } } = request

    allParams({ adminID, accountID })
        .then(items => response.json({ 
            status: 200, 
            items: items ? 
                items.map(({ _id, name }) => ({ id: _id, name })) 
                :
                []
        }))
        .catch(next)
})

router.get('/accounts/:accountID/params/:paramID',  (request, response, next) => {
    const { adminID, params: { accountID, paramID } } = request

    paramById({ adminID, paramID, accountID })
        .then(param => {
            if (param === null) return response
                .status(404)
                .json({ status: 404, message: 'Учётная запись не найдена' })

            const prm = param.toJSON()
            const id = prm._id
            delete prm._id

            response.json(Object.assign({ status: 200, id }, prm))
        })
        .catch(next)
})

router.put('/accounts/:accountID/params/:paramID',  (request, response, next) => {
    const { adminID, params: { accountID, paramID } } = request

    updateParam({ adminID, paramID, accountID, data: request.body })
        .then(() => response.json({ status: 200 }))
        .catch(next)
})

router.all('*', (request, response) => response.status(404).json({
    status: 404,
    message: 'Здесь ничего нет'
}))

module.exports = router