const mongoose = require('mongoose')
const { Schema } = mongoose
const { ObjectId } = Schema.Types
const { generate } = require('./utils/namer')
const formatNumber = require('./utils/formatNumber')

const Log = mongoose.model('Log', new Schema({
    type: String,
    who: { type: ObjectId, ref: 'Session' },
    when: { type: Date, expires: 1209600, default: Date.now() },
    what: String,
    details: String,
}))

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
    email: String,
    password: String
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
    lastUpdate: { type: Date, default: Date.now() },
    name: String, 
    details: String,
    phones: [String],
    notes: [String],
    funnelStep: String,
    nonTargetedReason: String,
    deal: {
        amount: Number,
        comment: String
    },
    reject: {
        reason: String,
        comment: String
    }
})
customerSchema.pre('save', function( next ) {
    if ( !this.name ) this.name = generate()
    this.phones = this.phones.map( phone => formatNumber(phone) )
    this.lastUpdate = new Date()
    next()
})
const Customer = mongoose.model('Customer', customerSchema)

const Call = mongoose.model('Call', new Schema({
    account: { type: ObjectId, ref: 'Account' },
    customer: { type: ObjectId, ref: 'Customer' },
    trunk: { type: ObjectId, ref: 'Trunk' },
    user: { type: ObjectId, ref: 'User' },
    date: { type: Date, default: Date.now() },
    record: String,
    duration: {
        waiting: Number,
        conversation: Number
    },
    isCallback: Boolean
}))


module.exports = {
    Log,
    Account,
    User,
    Trunk,
    Call,
    Customer
}