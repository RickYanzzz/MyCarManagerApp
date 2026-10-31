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
	const page = Math.max(1, parseInt(event.page) || 1)
	const pageSize = Math.min(100, Math.max(1, parseInt(event.pageSize) || 20))
	const where = { enterpriseId: auth.enterpriseId, memberId }

	const countRes = await db.collection('member_transactions').where(where).count()
	const res = await db.collection('member_transactions')
		.where(where)
		.orderBy('time', 'desc')
		.skip((page - 1) * pageSize)
		.limit(pageSize)
		.get()

	return {
		code: 200,
		status: 'success',
		data: {
			list: res.data || [],
			total: countRes.total || 0,
			page,
			pageSize
		}
	}
}
