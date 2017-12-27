const moment = require('moment')
moment.locale('ru')

function isToday(mDate) {
    const today = moment().startOf('day')
    return mDate.isSame(today, 'd')
}

module.exports = function formatDate(originalDate, noTime = false) {
    const callDate = moment(originalDate)
    const format = 'D MMMM' + noTime? '' : '  HH:mm'
    return isToday(callDate) ?
        'Сегодня, ' + callDate.format(format) :
        callDate.format(format)
}