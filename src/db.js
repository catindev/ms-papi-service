const mongoose = require('mongoose')
const { log, warn } = console

mongoose.Promise = Promise

mongoose.connection.openUri('mongodb://localhost/ms3')
	.once('open', () => log('MongoDB connected'))
	.on('close', () => {
		log('MongoDB connection closed')
		process.exit(0)
	})
	.on('error', error => warn('Warning', error))

module.exports = mongoose
