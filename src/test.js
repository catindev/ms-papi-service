const mongoose = require('mongoose')
const toObjectId = require('mongoose').Types.ObjectId

mongoose.Promise = Promise
mongoose.connection.openUri('mongodb://localhost/ms3')
  

const { createAdmin, isAdmin } = require('./queries/admins')
const { SignIn, SignOut, getTokenOwner } = require('./queries/sessions')
const { createAccount, updateAccount, isAuthor } = require('./queries/accounts')
const { createUser } = require('./queries/users')


console.log(Object.keys(mongoose.connection.collections))

mongoose.connection.collections.logs.drop( err => {
	if (err) throw err
    console.log('collection dropped')
})

// createAdmin({ login: 'tv', password: '14005000' })
// 	.then( console.log )
// 	.catch( console.log )

// SignIn({ login: 'test', password: '111' })
// 	.then( console.log )
// 	.catch( console.log )

// getTokenOwner({ token: 'af41f77c9a9924290d5daac957078cb0' })
// 	.then( console.log )
// 	.catch( console.log )


// isAdmin({ _id: '59c27e5737b6200b2ee62bf4' })
// 	.then( console.log )
// 	.catch( console.log )


// updateAccount({
// 	userID: '59c27e5737b6200b2ee62ff4',
// 	_id: '59c2a0e53267c111b351f449',
// 	data: {
// 		funnelSteps: [ '1', '2', '3']
// 	}
// })
// 	.then( console.log )
// 	.catch( console.log )


// createUser({ 
// 	accountID: '59c2a0e53267c111b351f449', 
// 	userID: '59c27e5737b6200b2ee62ff4',
// 	name: 'Уася'
// })
// 	.then( console.log )
// 	.catch( console.log )

// isAuthor({ 
// 	account: toObjectId('59c2a0e53267c111b351f449'), 
// 	userID: toObjectId('59c4b78ccfb16b2e22727534') 
// })
// 	.then( console.log )
// 	.catch( console.log )
