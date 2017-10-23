const { Session, User } = require('../schema')
const md5 = require('../utils/md5')
const CustomError = require('../utils/error')
const formatNumber = require('../utils/formatNumber')

async function SignIn({ login, password }) {
	const passwordHash = md5(`${ password }wow! much salt!`)

	const user = await User.findOne({ 
		phones: formatNumber(login,false), password: passwordHash 
	})

	if (!user || user === null) throw new CustomError('Неверный номер телефона или пароль', 400)

	const token = md5(`${ new Date().getTime() }@${ passwordHash }@${ Math.random() }@woop!woop`)
	
	const newSession = new Session({ user, token })
	newSession.save()

	return token
}


async function SignOut({ token }) {
	const { result } = await Session.findOne({ token }).remove().exec()
	return result
}


async function getTokenOwner({ token }) {

	function removeSystemKeys(original) {
		let replicant = JSON.parse(JSON.stringify(original))
		delete replicant.password
		delete replicant.__v
		return replicant
	}

	const session = await Session.findOne({ token })
		.populate('user')
		.exec()
		
	if (session === null) throw new CustomError('Сессия не найдена', 403)

	const { user } = session
	return removeSystemKeys(user)		
}

module.exports = { SignIn, SignOut, getTokenOwner }