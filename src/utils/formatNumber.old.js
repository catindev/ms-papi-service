const CustomError = require('./error')

function errorFor(phone) {
    return function(text) {
        throw new CustomError(`${ phone } ${ text }`, 400)
    }
}

module.exports = function formatNumber( phone, strict = true ) {
    const error = errorFor(phone);

    if ( !phone ) return strict ? error('введите номер') : false

    const formatted = (phone.replace(/ /g,'')).replace(/\D/g,'')

    return formatted[0] === '8'?
        formatted.replace('8','7')
        :
        formatted   
}
