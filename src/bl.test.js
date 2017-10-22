const mongoose = require('mongoose')
const toObjectId = require('mongoose').Types.ObjectId

mongoose.Promise = Promise
mongoose.connection.openUri('mongodb://localhost/ms3')

const collections = Object.keys(mongoose.connection.collections)

console.log(Object.keys(mongoose.connection.collections))

mongoose.connection.collections.logs.drop( err => {
	if (err) throw err
    console.log('collection dropped')
})
