const moment = require('moment')
moment.locale('ru')

function isToday(mDate) {
    const today = moment().startOf('day')
    return mDate.isSame(today, 'd')
}

module.exports = function formatDate(originalDate, noTime = false) {
    const callDate = moment(originalDate)
    return isToday(callDate) ?
        'Сегодня, ' + callDate.format('D MMMM' + noTime? '' : '  HH:mm') :
        callDate.format('D MMMM' + noTime? '' : '  HH:mm')
}