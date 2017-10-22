function CustomError(message = '', code = 500) {
  this.message = message
  this.code = code
  const error = new Error(this.message)
  error.name = this.name
  this.stack = error.stack
}

CustomError.prototype = Object.create(Error.prototype)

module.exports = CustomError