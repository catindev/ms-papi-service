const CustomError = require('./error')

function errorFor(phone) {
    return function(text) {
        throw new CustomError(`${ phone } ${ text }`, 400)
    }
}

module.exports = function formatNumber( phone, strict = true ) {
    const error = errorFor(phone);

    if ( !phone ) return strict ? error('Введите номер') : false

    let formatted = (phone.replace(/ /g,'')).replace(/\D/g,'')

    if (formatted.length === 10) formatted = '8' + formatted

    if (formatted.length === 11 && formatted[0] === '7') formatted = formatted.replace('7','8')
 
    return formatted  
}
