const moment = require('moment')
moment.locale('ru')

module.exports = function formatDate(originalDate, noTime = false) {
    const callDate = moment(originalDate)
    return isToday(callDate) ?
        'Сегодня, ' + callDate.format('D MMMM' + noTime? '' : '  HH:mm') :
        callDate.format('D MMMM' + noTime? '' : '  HH:mm')
}