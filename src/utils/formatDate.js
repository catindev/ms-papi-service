const moment = require('moment')

module.exports = function formatDate(originalDate, format, locale = 'ru') {
    moment.locale('ru')
    const callDate = moment(originalDate)
    return callDate.format(format)
}