const mongoose = require('mongoose')
mongoose.Promise = Promise

mongoose.connection.openUri('mongodb://ms3usr:mp7u@ds117876-a0.mlab.com:17876,ds117876-a1.mlab.com:17876/ms3?replicaSet=rs-ds117876')
    .once('open', () => {
        const stest = require('./queries/s-test')

        stest({
            userID: "59ed0954169b347081913a71",
            customerID: "5a92c5b9b1254758fecec636"
        })
            .then(result => {
                console.log(result)
                mongoose.connection.close()
                process.exit(0)
            })
            .catch(error => {
                console.log('Ошибка!', error.stack)
                mongoose.connection.close()
                process.exit(0)
            })
    })
    .on('close', () => {
        log('MongoDB connection closed')
        process.exit(0)
    })
    .on('error', error => warn('Warning', error))