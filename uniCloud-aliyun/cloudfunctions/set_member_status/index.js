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
	const status = parseInt(event.status)
	if (!memberId) return fail(400, '缺少会员ID')
	if (status !== 0 && status !== 1) return fail(400, '状态必须为 0 或 1')

	const memberRes = await db.collection('member').doc(memberId).get()
	const member = (memberRes.data || [])[0]
	if (!member || member.enterpriseId !== auth.enterpriseId) return fail(404, '会员不存在')

	await db.collection('member').doc(memberId).update({
		status,
		updateTime: Date.now()
	})
	return { code: 200, status: 'success', data: { _id: memberId, status } }
}
