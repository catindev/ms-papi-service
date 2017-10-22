const mongoose = require('mongoose')

mongoose.Promise = Promise
mongoose.connection.openUri('mongodb://localhost/ms3')

const { createAdmin } = require('./queries/admins')

createAdmin({ login: 'roman', password: '111rRr', access: 'partner' })
	.then( console.log )
	.catch( console.log )