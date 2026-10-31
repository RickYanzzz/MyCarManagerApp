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
	if (!memberId) return fail(400, '缺少会员ID')
	const memberRes = await db.collection('member').doc(memberId).get()
	const member = (memberRes.data || [])[0]
	if (!member || member.enterpriseId !== auth.enterpriseId) return fail(404, '会员不存在')

	const data = { updateTime: Date.now() }
	if (event.name !== undefined) {
		const name = String(event.name || '').trim()
		if (!name) return fail(400, '姓名不能为空')
		data.name = name
	}
	if (event.phone !== undefined) {
		const phone = String(event.phone || '').trim()
		if (!phone) return fail(400, '手机号不能为空')
		const dup = await db.collection('member').where({ enterpriseId: auth.enterpriseId, phone }).get()
		const exists = (dup.data || []).some(item => item._id !== memberId)
		if (exists) return fail(409, '该手机号已被其他会员使用')
		data.phone = phone
	}
	if (event.level !== undefined) data.level = String(event.level || '普通会员').trim() || '普通会员'
	if (event.remark !== undefined) data.remark = String(event.remark || '').trim()

	await db.collection('member').doc(memberId).update(data)
	const updated = await db.collection('member').doc(memberId).get()
	return { code: 200, status: 'success', data: (updated.data || [])[0] || {} }
}
