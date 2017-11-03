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


    if ( formatted[0] === '+' && formatted[1] === '7' ) 
        formatted = formatted.replace('+7','')

    // warning! это условие пропускает номера в 7 цифр начинающихся с 8  
    if ( formatted[0] === '8' &&  formatted.length > 6) 
        formatted = formatted.replace('8','')

    formatted = formatted.replace(/\D/g,'')

    const { length } = formatted

    if ( length > 10 ) 
        return strict ? error('в номере лишние цифры (не больше 10)') : false

    if ( length < 10 && length > 6) 
        return strict ? error('номер слишком короткий (больше 6, но меньше 10)') : false        

    if ( length === 6 ) formatted = `7212${ formatted }`

    return `+7${ formatted }`
}
