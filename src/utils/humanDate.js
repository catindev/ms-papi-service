const moment = require('moment')
moment.locale('ru')

function formatDateForHumans(originalDate, noTime = false) {
    const callDate = moment(originalDate)
    const today = moment(new Date())
    return today.diff(callDate, 'hours') <= 23 ?
        callDate.fromNow() :
        callDate.format('DD MMMM HH:mm')
}

function isToday(mDate) {
    const today = moment().startOf('day')
    return mDate.isSame(today, 'd')
}

function formatDate(originalDate) {
    const callDate = moment(originalDate)
    return isToday(callDate) ?
        'Сегодня, ' + callDate.format('D MMMM' + noTime? '' : '  HH:mm') :
        callDate.format('D MMMM' + noTime? '' : '  HH:mm')
}

module.exports = formatDate