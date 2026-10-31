'use strict';
const db = uniCloud.database()

function fail(code, message) {
	return { code, status: 'error', message }
}

async function getOperator(event) {
	const userId = String(event.userId || '')
	if (!userId) return { error: fail(401, '请先登录') }
	const res = await db.collection('user').doc(userId).get()
	const user = (res.data || [])[0]
	if (!user) return { error: fail(401, '用户不存在') }
	if (user.status === 0 || user.status === false) return { error: fail(403, '账号已停用') }
	if (!user.enterpriseId) return { error: fail(403, '账号未绑定门店') }
	return { user, enterpriseId: user.enterpriseId }
}

exports.main = async (event, context) => {
	const auth = await getOperator(event)
	if (auth.error) return auth.error

	const enterpriseId = auth.enterpriseId
	const memberId = String(event.memberId || '')
	const phone = String(event.phone || '').trim()
	const cardNo = String(event.cardNo || '').trim()
	const carNumber = String(event.carNumber || '').trim()

	let member = null
	if (memberId) {
		const res = await db.collection('member').doc(memberId).get()
		member = (res.data || [])[0] || null
	} else if (phone) {
		const res = await db.collection('member').where({ enterpriseId, phone }).get()
		member = (res.data || [])[0] || null
	} else if (cardNo) {
		const res = await db.collection('member').where({ enterpriseId, cardNo }).get()
		member = (res.data || [])[0] || null
	} else if (carNumber) {
		const carRes = await db.collection('car_info').where({ enterpriseId, carNumber }).get()
		const car = (carRes.data || [])[0]
		if (car && car.memberId) {
			const res = await db.collection('member').doc(car.memberId).get()
			member = (res.data || [])[0] || null
		}
	} else {
		return fail(400, '请提供会员ID、手机号、卡号或车牌号')
	}

	if (!member || member.enterpriseId !== enterpriseId) return fail(404, '会员不存在')

	const carRes = await db.collection('car_info').where({ enterpriseId, memberId: member._id }).get()
	return {
		code: 200,
		status: 'success',
		data: Object.assign({}, member, { cars: carRes.data || [] })
	}
}
