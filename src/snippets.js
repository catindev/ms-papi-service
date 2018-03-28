

db.breadcrumbs.find({ account: ObjectId("59ed091a169b347081913a71") }).pretty()

// Почистить акк
db.customers.remove({ account: ObjectId("59ed091a169b347081913a71") })
db.breadcrumbs.remove({ account: ObjectId("59ed091a169b347081913a71") })
db.calls.remove({ account: ObjectId("59ed091a169b347081913a71") })
db.contacts.remove({ account: ObjectId("59ed091a169b347081913a71") })


// Удалить акк и его всё
db.trunks.remove({ account: ObjectId("59ed091a169b347081913a71") })
db.params.remove({ account: ObjectId("5a0145709e174f5a4b37f6c2") })
db.users.remove({ account: ObjectId("5a0145709e174f5a4b37f6c2") })
db.accounts.remove({ _id: ObjectId("5a0145709e174f5a4b37f6c2") })

