const moment = require('moment')
moment.locale('ru')

function isToday(mDate) {
    const today = moment().startOf('day')
    return mDate.isSame(today, 'd')
}

module.exports = function formatDate(originalDate, noTime = false) {
    const md = moment(originalDate)
    return isToday(md)?
        'Сегодня, ' + md.format('D MMMM' + (noTime? '' : ' HH:mm')) 
        :
        md.format('D MMMM' + (noTime? '' : ' HH:mm')) 
}