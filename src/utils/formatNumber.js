const CustomError = require('./error')

function errorFor(phone) {
    return function(text) {
        throw new CustomError(`${ phone } ${ text }`, 400)
    }
}

module.exports = function formatNumber( phone, strict = true ) {
    const error = errorFor(phone);

    if ( !phone ) return strict ? error('введите номер') : false

    let formatted = phone.replace(/ /g,'')
    formatted = formatted.replace(/\D/g,'')

    let splitted = formatted.split('')
    if (splitted[0] === '8') splitted[0] = '+7'
    if (splitted[0] === '7') splitted[0] = '+7'     
    formatted = splitted.join('')    
    if ( formatted.length === 6 ) formatted = `+77212${ formatted }`    
    return formatted
}
