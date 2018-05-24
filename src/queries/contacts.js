const toObjectId = require('mongoose').Types.ObjectId
const { Account, Contact, Customer, Call, Trunk, Param, Log } = require('../schema')
const { userById } = require('./users')
const CustomError = require('../utils/error')
const formatNumber = require('../utils/formatNumber')
const request = require('request-promise')

async function createContact({ userID, customerID, data }) {
    // ! используется в customers.js в ф-ии createColdLead

    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const { account: { _id } } = await userById({ userID })

    data.phone = formatNumber(data.phone)
    const contact = await Contact.findOne({ account: _id, phone: data.phone }).populate('customer').exec()
    if (contact) throw new CustomError(`Такой номер уже сохранён под именем ${contact.name} у клиента ${contact.customer.name}`, 400)

    const newContact = new Contact(Object.assign({}, data, {
        account: _id, customer: customerID
    }))
    const createdContact = await newContact.save()

    return await Customer.findOneAndUpdate(
        { _id: customerID },
        { $push: { contacts: createdContact._id } },
        { new: true }
    )
}

async function getContacts({ userID, customerID, populate = '' }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const { account: { _id } } = await userById({ userID })

    return await Contact.find({ account: _id, customer: customerID }).populate(populate).lean().exec()
}

async function getContact({ userID, contactID, populate = '' }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof contactID === 'string') contactID = toObjectId(contactID)

    const { account: { _id } } = await userById({ userID })

    return await Contact.findOne({ account: _id, _id: contactID }).populate(populate).lean().exec()
}

async function removeContact({ userID, contactID }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof contactID === 'string') contactID = toObjectId(contactID)

    const { account: { _id } } = await userById({ userID })

    const contact = await Contact.findOne({ _id: contactID, account: _id })
        .populate('customer').exec()

    if (!contact || contact === null)
        throw new CustomError(`Не могу найти и удалить контакт`, 400)

    await Customer.findOneAndUpdate(
        { _id: contact.customer._id },
        { $pull: { contacts: contactID } },
        { new: true }
    )

    return await contact.remove()
}

async function updateContact({ userID, contactID, data }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof contactID === 'string') contactID = toObjectId(contactID)

    data.phone && (data.phone = formatNumber(data.phone))
    const { account: { _id } } = await userById({ userID })

    return await Contact.findOneAndUpdate({ _id: contactID }, { $set: data }, { new: true })
}

async function callbackToContact({ userID, contactID }) {
    const crm_user_id = userID

    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof contactID === 'string') contactID = toObjectId(contactID)

    const { account: { _id }, phones } = await userById({ userID })

    const contact = await Contact
        .findOne({ _id: contactID, account: _id })
        .populate({
            path: 'customer', model: 'Customer',
            populate: { path: 'trunk', model: 'Trunk' }
        }).exec()

    if (!contact || contact === null)
        throw new CustomError(`Не могу найти контакт и позвонить ему. Возможно он был удалён`, 400)

    const options = {
        uri: 'http://185.22.65.50/cold_call.php',
        qs: {
            cn: contact.phone.replace('+7', '8'),
            un: phones[0].replace('+7', '8'),
            tr: contact.customer.trunk.phone.replace('+7', '8'),
            call_id: 'cold_call',
            secret_key: '2c22d5c2ed37ea03db53ff931e7a9cf6',
            // debug
            crm_user_id, 
            crm_customer_status: contact.customer.funnelStep
        },
        headers: { 'User-Agent': 'Mindsales-CRM' },
        json: true
    }

    const response = await request(options)

    return {
        params: {
            cn: contact.phone.replace('+7', '8'),
            un: phones[0].replace('+7', '8'),
            tr: contact.customer.trunk.phone.replace('+7', '8')
        },
        response
    }
}

/* System patches */

async function __createContact({ accountID, customerID, data }) {
    if (typeof accountID === 'string') accountID = toObjectId(accountID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    // data.phone = formatNumber(data.phone)
    const contact = await Contact.findOne({ account: accountID, phone: data.phone })
    if (contact) throw new CustomError(`Номер ${data.phone} уже сохранён под именем ${contact.name}`, 400)

    const newContact = new Contact(Object.assign({}, data, {
        account: accountID, customer: customerID
    }))
    const createdContact = await newContact.save()

    return await Customer.findOneAndUpdate(
        { _id: customerID },
        { $push: { contacts: createdContact._id } },
        { new: true }
    )
}

async function setContacts4All() {
    const customers = await Customer.find({ contacts: { $exists: false } })
    if (customers.length === 0) return 0

    let counter = 0
    for (customer of customers) {
        counter++
        const patchedCustomer = await __createContact({
            accountID: customer.account,
            customerID: customer._id,
            data: {
                phone: customer.phones[0],
                name: 'Основной'
            }
        })
        console.log(counter, patchedCustomer.name, patchedCustomer.contacts)
    }
    return counter
}


module.exports = {
    createContact, getContacts, getContact, removeContact,
    updateContact, callbackToContact,
    setContacts4All
}