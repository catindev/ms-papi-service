
// Удалить акк и его всё
db.trunks.remove({ account: ObjectId("5a0145709e174f5a4b37f6c2") })
db.params.remove({ account: ObjectId("5a0145709e174f5a4b37f6c2") })
db.customers.remove({ account: ObjectId("5a0145709e174f5a4b37f6c2") })
db.calls.remove({ account: ObjectId("5a0145709e174f5a4b37f6c2") })
db.users.remove({ account: ObjectId("5a0145709e174f5a4b37f6c2") })
db.accounts.remove({ _id: ObjectId("5a0145709e174f5a4b37f6c2") })

