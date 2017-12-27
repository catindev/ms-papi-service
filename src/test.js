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

// const chunk = require('chunk-date-range')

// var start = new Date('2017-12-01');
// var end = new Date('2017-12-17');
// var chunks = 'week';

// console.log(chunk(start, end, chunks))

const f = require('./utils/humanDate')

console.log(f(new Date(), true))