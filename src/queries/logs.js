const toObjectId = require('mongoose').Types.ObjectId
const { Account, Customer, Call, Trunk, Param, Log } = require('../schema')
const humanDate = require('../utils/humanDate')

async function addLog({ who, type, what, payload = {} }) {
    if (who && typeof who === 'string') who = toObjectId(who)

    const newLog = new Log({ 
        type, who, when: new Date(), what, payload
    })
    return await newLog.save()
}

async function cleanLog() {
    return await Log.remove({})
}

async function getLog({ }) {
    const log = await Log.find({}).sort('-_id')

    return log.length > 0?
        log.map( ({ type, when, what, payload }) => ({ type, when: humanDate(when), what, payload }))
        :
        []
}

module.exports = {
    addLog,
    getLog,
    cleanLog
}