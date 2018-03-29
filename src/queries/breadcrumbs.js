const toObjectId = require('mongoose').Types.ObjectId
const { Account, Customer, Contact, Call, Trunk, Param, Log, Breadcrumb } = require('../schema')
const CustomError = require('../utils/error')
const formatNumber = require('../utils/formatNumber')
const formatNumberForHumans = require('../utils/formatNumberForHumans')
const humanDate = require('../utils/humanDate')
const formatDate = require('../utils/formatDate')
const { userById } = require('./users')
const { addLog } = require('./logs')
const request = require('request-promise')
const md5 = require('../utils/md5')
const moment = require('moment')
const { sortBy } = require('lodash')
const { createContact } = require('./contacts')

async function createBreadcrumb({ userID, customerID, data }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const { account: { _id } } = await userById({ userID })

    const newBreadcrumb = new Breadcrumb(Object.assign({}, data, {
        account: _id,
        customer: customerID,
        user: userID
    }))
    const createdBreadcrumb = await newBreadcrumb.save()

    return await Customer.findOneAndUpdate(
        { _id: customerID },
        { $push: { breadcrumbs: createdBreadcrumb._id } },
        { new: true }
    )
}

async function getBreadcrumbs({ userID, customerID }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const { account: { _id } } = await userById({ userID })

    return await Breadcrumb
        .find({ account: _id, customer: customerID })
        .populate('user, call')
        .lean()
        .exec()
}

async function createNote({ userID, customerID, comment }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    return await createBreadcrumb({
        userID, customerID,
        data: { type: 'note', comment }
    })
}

async function updateNote({ userID, breadcrumbID, comment }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof breadcrumbID === 'string') breadcrumbID = toObjectId(breadcrumbID)

    return await Breadcrumb.findOneAndUpdate(
        { _id: breadcrumbID }, { $set: { comment } }, { new: true }
    )
}

async function removeNote({ userID, breadcrumbID }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof breadcrumbID === 'string') breadcrumbID = toObjectId(breadcrumbID)

    const { account: { _id } } = await userById({ userID })

    const breadcrumb = await Breadcrumb
        .findOne({ _id: breadcrumbID, account: _id })
        .populate('customer')
        .exec()

    if (!breadcrumb || breadcrumb === null)
        throw new CustomError(`Не могу найти и удалить заметку`, 400)

    await Customer.findOneAndUpdate(
        { _id: breadcrumb.customer._id },
        { $pull: { breadcrumbs: breadcrumbID } },
        { new: true }
    )

    return await breadcrumb.remove()
}

module.exports = { createBreadcrumb, createNote, updateNote, removeNote }