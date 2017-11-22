const mongoose = require('mongoose')
const { log, warn } = console

mongoose.Promise = Promise

mongoose.connection.openUri('mongodb://ms3usr:mp7u@ds117876-a0.mlab.com:17876,ds117876-a1.mlab.com:17876/ms3?replicaSet=rs-ds117876')
	.once('open', () => log('MongoDB connected'))
	.on('close', () => {
		log('MongoDB connection closed')
		process.exit(0)
	})
	.on('error', error => warn('Warning', error))

module.exports = mongoose
