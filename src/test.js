// const f = require('./utils/formatNumber.old')
// const fh = require('./utils/formatNumberForHumans')

// console.log(fh(f('801')))
// console.log(fh(f('921231')))
// console.log(fh(f('7011234567')))
// console.log(fh(f('+77016662222')))
// console.log(fh(f('+7 (701) 333 44 22')))
// console.log(fh(f('+7 (701) 444-33-11')))
// console.log(fh(f('8 (701) 555-66-77')))
// console.log(fh(f('+7 (7212) 555-667')))
// console.log(fh(f('7212555667')))

/****************************/

const f = require('./utils/humanDate')
const chunk = require('chunk-date-range')


const moment = require('moment')
moment.locale('ru')

function hf(od, eow = false, is5d = false) {
    const subtract = is5d ? 3 : 1
    return eow ?
        moment(od).subtract(subtract, 'd').format('D MMMM')
        :
        moment(od).format('D MMMM')
}


// Начало недели первого дня месяца
const startOfMonth = moment(new Date()).startOf('month')
console.log(startOfMonth.startOf('week').format('D MMMM'))

// Конец недели последнего дня месяца
const endOfMonth = moment(new Date()).endOf('month')
console.log(endOfMonth.endOf('week').format('D MMMM'))

/****************/

var start = new Date(startOfMonth.startOf('week'))
var end = new Date(endOfMonth.endOf('week'))
var chunks = 'week'

const rama = chunk(start, end, chunks).map((chunk, index) => ({
    name: `Неделя # ${index}`,
    interval: `c ${hf(chunk.start)} по ${hf(chunk.end, true, true)}`,
    start: chunk.start,
    end: chunk.end,
    wid: `${new Date(chunk.start).getTime()}${new Date(chunk.end).getTime()}`
}));

rama.splice(0, 1)

console.log(rama)

