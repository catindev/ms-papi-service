const toObjectId = require('mongoose').Types.ObjectId
const { Session, User, Password } = require('../schema')
const { userById } = require('./users')
const md5 = require('../utils/md5')
const CustomError = require('../utils/error')
// const formatNumber = require('../utils/formatNumber')
function formatNumber(phone) {
	phone = phone.replace(/\D/g, '')
	if (phone[0] === '8') phone = phone.replace('8', '')
	return phone
}

const request = require('request-promise')

const { addLog } = require('./logs')

async function createPassword({ phone }) {
	const ephone = phone
	phone = formatNumber(phone)

	const user = await User.findOne({ $or: [{ phones: phone }, { phones: `+${phone}` }, { phones: `+7${phone}` }, { phones: `8${phone}` }] })
	if (!user || user === null) throw new CustomError(`Номер ${ephone} у нас не зарегистрирован`, 400)

	let userPhone = '';
	for (let number of user.phones) {
		number = number.replace(/\D/g, '')
		if (phone === number) userPhone = number
	}

	const code = Math.floor(1000 + Math.random() * 9000)

	const newPassword = new Password({ user: user._id, code: md5(`${code}`) })
	newPassword.save()

	const response = await request({
		uri: 'http://smsc.ru/sys/send.php',
		qs: {
			login: 'catindev', psw: '578e493c84f81d6f07046a4bb73bdaa0',
			phones: userPhone, mes: `Пароль для входа в Майндсейлс — ${code}`,
			period: '0.1', charset: 'utf-8'
		}
	})

	addLog({
		who: 'Unauthorized',
		type: 'login',
		what: 'вход через SMSC',
		payload: { phone, response }
	})

	return response
}

async function verifyPassword({ code }) {
	const password = await Password.findOne({ code: md5(`${code}`) })
		.populate('user')
		.exec()

	if (!password || password === null) throw new CustomError('Код неправильный или устарел', 400)

	const token = md5(`${new Date().getTime()}@${code}@${Math.random()}@woop!woop${password.createdAt}`)

	const newSession = new Session({
		user: password.user._id, token, account: password.user.account
	})
	newSession.save()
	await Password.remove({ code })

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
		.lean()
		.exec()

	if (session === null) throw new CustomError('Сессия не найдена', 403)
	const { user } = session
	return removeSystemKeys(user)
}

async function findOneSession({ account }) {
	if (account === undefined) throw new CustomError('Нужно указать аккаунт', 403)

	if (typeof account === 'string') account = toObjectId(account)
	const session = await Session.findOne({ account })

	return session ? session.token : false
}

module.exports = { createPassword, verifyPassword, SignOut, getTokenOwner, findOneSession }
