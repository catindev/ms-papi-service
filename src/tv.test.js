const mongoose = require('mongoose')

mongoose.Promise = Promise

// [ 5a8d8329079efe4300183b79, 5a8d840eed028f433241b239 ]

mongoose.connection.openUri('mongodb://ms3usr:mp7u@ds117876-a0.mlab.com:17876,ds117876-a1.mlab.com:17876/ms3?replicaSet=rs-ds117876')
	.once('open', () => {
		const { setContacts4All } = require('./queries/contacts')

		setContacts4All({
			userID: "59ed0954169b347081913a72",
			contactID: "5a8d8329079efe4300183b79"
		})
			.then(result => {
				console.log('Patched', result)
				mongoose.connection.close()
				process.exit(0)
			})
			.catch(error => {
				console.log('Ошибка!', error.message)
				mongoose.connection.close()
				process.exit(0)
			})
	})
	.on('close', () => {
		log('MongoDB connection closed')
		process.exit(0)
	})
	.on('error', error => warn('Warning', error))