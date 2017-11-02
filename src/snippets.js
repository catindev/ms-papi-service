db.users.remove({ account: ObjectId("59f0e85194d14316e7632190") })
db.trunks.remove({ account: ObjectId("59f0e85194d14316e7632190") })
db.params.remove({ account: ObjectId("59f0e85194d14316e7632190") })
db.accounts.remove({ _id: ObjectId("59f0e85194d14316e7632190") })

db.customers.remove({ account: ObjectId("59f7fa8894d14316e763219f") })
db.calls.remove({ account: ObjectId("59f7fa8894d14316e763219f") })