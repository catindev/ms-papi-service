module.exports = function formatNumberForHumans(number) {
    if (!number) return false

    if (number.length < 6) return `${ number.replace('+7', '') }`

    const re = /(?:([\d]{1,}?))??(?:([\d]{1,3}?))??(?:([\d]{1,3}?))??(?:([\d]{2}))??([\d]{2})$/
    let formatted = (number.replace(re,
        (all, a, b, c, d, e) => (a ? a + ' ' : '') +
        (b ? b + ' ' : '') +
        (c ? c + '-' : '') +
        (d ? d + '-' : '') + e
    )).split(' ')

    if (formatted[1] === '727') {
        formatted[1] += formatted[2][0]
        formatted[2] = formatted[2].substring(1)
    }

    return `${formatted[0]} (${formatted[1]}) ${formatted[2]}`
}