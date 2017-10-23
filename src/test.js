const mongoose = require('mongoose')
const toObjectId = require('mongoose').Types.ObjectId

mongoose.Promise = Promise
mongoose.connection.openUri('mongodb://localhost/ms3')
  
const { findCustomers } = require('./queries/customers')


// console.log(Object.keys(mongoose.connection.collections))

// mongoose.connection.collections.logs.drop( err => {
// 	if (err) throw err
//     console.log('collection dropped')
// })

// http://localhost:5002/customers
//   ?token=8838e13485d282ac9249de8289d81e88
//   &options[sort][created]=-1
//   &options[limit]=1
//   &fields[]=name&fields[]=phones
//   &searchQuery=


findCustomers({ userID: toObjectId('59df1692787ab92183342035'), search: '3321' })
	.then( console.log )
	.catch( console.log )
