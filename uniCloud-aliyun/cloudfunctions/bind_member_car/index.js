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

	const memberId = String(event.memberId || '')
	const carId = String(event.carId || '')
	const carNumber = String(event.carNumber || '').trim()
	const orderId = String(event.orderId || '')

	let car = null
	if (carId) {
		const res = await db.collection('car_info').doc(carId).get()
		car = (res.data || [])[0] || null
	} else if (carNumber) {
		const res = await db.collection('car_info').where({ enterpriseId: auth.enterpriseId, carNumber }).get()
		car = (res.data || [])[0] || null
	} else {
		return fail(400, '请提供车辆ID或车牌号')
	}
	if (!car || car.enterpriseId !== auth.enterpriseId) return fail(404, '车辆不存在')

	let member = null
	if (memberId) {
		const memberRes = await db.collection('member').doc(memberId).get()
		member = (memberRes.data || [])[0] || null
		if (!member || member.enterpriseId !== auth.enterpriseId) return fail(404, '会员不存在')
	}

	await db.collection('car_info').doc(car._id).update({ memberId })
	car.memberId = memberId

	if (orderId) {
		const orderRes = await db.collection('order').doc(orderId).get()
		const order = (orderRes.data || [])[0]
		if (!order || order.enterpriseId !== auth.enterpriseId) return fail(404, '订单不存在')
		await db.collection('order').doc(orderId).update({ memberId })
	}

	return { code: 200, status: 'success', data: { car, member } }
}
