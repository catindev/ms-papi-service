const toObjectId = require('mongoose').Types.ObjectId
const { Account, Customer, Contact, Call, User, Breadcrumb } = require('../schema')
const CustomError = require('../utils/error')
const humanDate = require('../utils/humanDate')

const moment = require('moment')
moment.locale('ru')

const EDIT_LIMIT = 1

function isToday(odate) {
    const momentDate = moment(odate)
    const today = moment().startOf('day')
    return momentDate.isSame(today, 'd')
}

async function createBreadcrumb({ userID, customerID, data }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const { account: { _id } } = await User
        .findOne({ _id: userID }, { __v: false, password: false })
        .populate('account')
        .exec()

    const newBreadcrumb = new Breadcrumb(Object.assign({}, data, {
        date: new Date(),
        account: _id,
        customer: customerID,
        user: userID
    }))
    const createdBreadcrumb = await newBreadcrumb.save()

    await Customer.findOneAndUpdate(
        { _id: customerID },
        { $push: { breadcrumbs: createdBreadcrumb._id } },
        { new: true }
    )

    return await Breadcrumb.populate(newBreadcrumb, { path: "user" })
}

async function getBreadcrumbs({ userID, customerID }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof customerID === 'string') customerID = toObjectId(customerID)

    const { account: { _id } } = await User
        .findOne({ _id: userID }, { __v: false, password: false })
        .populate('account')
        .exec()

    return await Breadcrumb
        .find({ account: _id, customer: customerID })
        .sort('-date')
        .populate('user call')
        .lean()
        .exec()
}

// TODO: не изменять историю если с момента создания прошло больше EDIT_LIMIT
async function updateBreadcrumb({ userID, breadcrumbID, data }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof breadcrumbID === 'string') breadcrumbID = toObjectId(breadcrumbID)

    return await Breadcrumb.findOneAndUpdate(
        { _id: breadcrumbID }, { $set: data }, { new: true }
    ).populate('user call').lean().exec()
}


// TODO: не удалять историю если с момента создания прошло больше EDIT_LIMIT
async function removeBreadcrumb({ userID, breadcrumbID }) {
    if (typeof userID === 'string') userID = toObjectId(userID)
    if (typeof breadcrumbID === 'string') breadcrumbID = toObjectId(breadcrumbID)

    const { account: { _id } } = await User
        .findOne({ _id: userID }, { __v: false, password: false })
        .populate('account')
        .exec()

    const breadcrumb = await Breadcrumb
        .findOne({ _id: breadcrumbID, account: _id })
        .populate('customer')
        .exec()

    if (!breadcrumb || breadcrumb === null)
        throw new CustomError(`Не могу найти и удалить историю`, 400)

    // if (isToday(breadcrumb.date))
    //     throw new CustomError(`Нельзя удалить историю старше одного дня`, 400)

    await Customer.findOneAndUpdate(
        { _id: breadcrumb.customer._id },
        { $pull: { breadcrumbs: breadcrumbID } },
        { new: true }
    )

    return await breadcrumb.remove()
}

module.exports = {
    createBreadcrumb, getBreadcrumbs, createBreadcrumb,
    updateBreadcrumb, removeBreadcrumb
}