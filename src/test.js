const mongoose = require('mongoose')
const { log, warn } = console

mongoose.Promise = Promise

mongoose.connection.openUri('mongodb://ms3usr:mp7u@ds117876-a0.mlab.com:17876,ds117876-a1.mlab.com:17876/ms3?replicaSet=rs-ds117876')
  .once('open', () => {
    const { incomingCallsStats } = require('./queries/stats')

incomingCallsStats({ userID: '59f965a594d14316e76321ec', start: '2017-12-01', end: '2017-12-12', interval: 'days' })
        .then(data => console.log(data))
        .catch(console.log)

  })
  .on('error', error => warn('Warning', error))



// const Moment = require('moment')
// const MomentRange = require('moment-range')
// const moment = MomentRange.extendMoment(Moment)
// moment.locale('ru')

// function formatInterval(date, type, index) {
//   if (type === 'weeks') return (index + 1) + ' неделя'
//   if (type === 'months') return date.format('MMMM')
//   return date.format('DD MMM')  
// }

// const rangeItemToMongoQuery = (date, type, index) => ({
//   name: formatInterval(date, type, index),
//   date: {
//     $gte: date.startOf( type ).toDate(),
//     $lt: date.endOf( type ).toDate()
//   }
// })

// const Type = 'months'

// const period = moment.range(new Date('2017-11-01').toISOString(), new Date('2017-12-12').toISOString())
// const RANGE = Array.from(period.by(Type, { step: 1 }))

// RANGE.forEach( (item, index) => console.log(rangeItemToMongoQuery(item, Type, index)))

