// 7747-682-86-17

function hf(phone) {
    const pattern = '+7 (123) 456-78-90', arr = phone.match(/\d/g);
    if (arr === null) return '???';
    let i = 0;
    return pattern.replace(/\d/g, (a, b) => {
        if (arr.length) i = b + 1;
        return arr.shift();
    }).substring(0, i);
}

const f = require('./utils/formatNumber')

console.log('#1', f('111'))

console.log('#1', hf(f('7747-682-86-17')))

console.log('#2', f('+77476828617'))

console.log('#3', f('+7 (747) 682-86-17'))

console.log('#4', f('8 (747) 682-86-17'))

console.log('#5', f('87476828617'))