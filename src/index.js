const PORT = 5002

const db = require('./db')

const Raven = require('raven')
Raven
  .config('https://b2736bef48ed4366a701b0c9c719c188:4bdf7206d0d24011bab5af8dcdb94b04@sentry.io/233712')
  .install()

const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const app = express()

const RateLimit = require('express-rate-limit')
const limiter = new RateLimit({
  windowMs: 1000,
  max: 10000,
  delayMs: 0
})

app.use(cookieParser())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(cors({
  "origin": "*",
  "methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
  "preflightContinue": false,
}))
app.use(limiter)

app.use(require('./utils/validateSession'))
app.use(require('./router'))

app.use((error, request, response, next) => {
  Raven.captureException(error)
  const { message, code = 500 } = error
  response.status(code).json({ status: code, message })
})

app.listen(PORT)

console.log(`Listening on ${PORT}...`)