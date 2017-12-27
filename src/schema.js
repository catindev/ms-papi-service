const mongoose = require('mongoose')
const { Schema } = mongoose
const { ObjectId, Mixed } = Schema.Types
const formatNumber = require('./utils/formatNumber')
const ttl = require('mongoose-ttl')

const Log = mongoose.model('Log', new Schema({
    type: String,
    who: { type: ObjectId, ref: 'User' },
    when: { type: Date, default: new Date() },
    what: String,
    payload: Mixed
}))


const PasswordSchema = new Schema({
    user: { type: ObjectId, ref: 'User' },
    code: String
})

PasswordSchema.plugin(ttl, { ttl: '3m' });
const Password = mongoose.model('Password', PasswordSchema)


const Account = mongoose.model('Account', new Schema({
    name: String,
    maxWaitingTime: { type: Number, default: 12000 },
    maxConversationTime: { type: Number, default: 120000 },
    funnelSteps: [String],
    noTargetReasons: { type: [String], default: ['Другое', 'Ошиблись номером'] },
    targetQuestion: { type: String, default: 'Клиент интересовался услугами вашей компании?' },
    author: { type: ObjectId, ref: 'Admin' },
    created: { type: Date, default: Date.now() }
}))


const User = mongoose.model('User', new Schema({
    account: { type: ObjectId, ref: 'Account' },
    created: { type: Date, default: Date.now() },
    access: { type: String, enum: ['boss', 'manager'], default: 'manager' },
    name: String,
    phones: [String],
    email: String
}))


const Session = mongoose.model('Session', new Schema({
    account: { type: ObjectId, ref: 'Account' },
    user: { type: ObjectId, ref: 'User' },
    token: String,
    created: { type: Date, default: Date.now() }
}))


const Trunk = mongoose.model('Trunk', new Schema({
    account: { type: ObjectId, ref: 'Account' },
    phone: String,
    name: String,
    active: { type: Boolean, default: false },
}))


const customerSchema = new Schema({
    account: { type: ObjectId, ref: 'Account' },
    trunk: { type: ObjectId, ref: 'Trunk' },
    user: { type: ObjectId, ref: 'User' },
    created: { type: Date, default: Date.now() },
    lastUpdate: { type: Date, default: new Date() },
    lastActivity: String,
    name: String,
    details: String,
    phones: [String],
    notes: String,
    funnelStep: String, // lead || cold, in-progress, ...custom, deal || reject
    deal: {
        amount: Number,
        comment: String,
        previousStep: String,
        date: Date
    },
    reject: {
        reason: String,
        comment: String,
        previousStep: String,
        date: Date
    },
    task: {
        what: String,
        when: Date
    }
}, { strict: false })

customerSchema.pre('save', function(next) {
    this.phones = this.phones.map(phone => formatNumber(phone))
    this.lastUpdate = new Date()
    next()
})

const Customer = mongoose.model('Customer', customerSchema)


const Call = mongoose.model('Call', new Schema({
    account: { type: ObjectId, ref: 'Account' },
    customer: { type: ObjectId, ref: 'Customer' },
    trunk: { type: ObjectId, ref: 'Trunk' },
    user: { type: ObjectId, ref: 'User' },
    answeredBy: { type: ObjectId, ref: 'User' },
    date: { type: Date, default: new Date() },
    record: String,
    duration: {
        waiting: Number,
        conversation: Number
    },
    isCallback: Boolean
}))

const Param = mongoose.model('Param', new Schema({
    account: { type: ObjectId, ref: 'Account' },
    name: String,
    id: String,
    type: { type: String, enum: ['text', 'select', 'multiselect'], default: 'text' },
    items: [String],
    description: String
}))


module.exports = {
    Log,
    Password,
    Account,
    User,
    Session,
    Trunk,
    Call,
    Customer,
    Param
}