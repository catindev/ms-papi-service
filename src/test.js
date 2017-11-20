const { findIndex } = require('lodash')

const users = [
  { 'user': 'barney',  'active': false },
  { 'user': 'fred',    'active': false },
  { 'user': 'pebbles', 'active': true }
]

console.log(findIndex(users, { user: 'fred' }))

