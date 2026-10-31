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

	const keyword = String(event.keyword || '').trim().toLowerCase()
	const page = Math.max(1, parseInt(event.page) || 1)
	const pageSize = Math.min(100, Math.max(1, parseInt(event.pageSize) || 20))
	const res = await db.collection('member').where({ enterpriseId: auth.enterpriseId }).orderBy('createTime', 'desc').get()
	let list = res.data || []
	if (keyword) {
		list = list.filter(item => {
			const text = [item.name, item.phone, item.cardNo].join(' ').toLowerCase()
			return text.indexOf(keyword) > -1
		})
	}
	const total = list.length
	const start = (page - 1) * pageSize
	return {
		code: 200,
		status: 'success',
		data: {
			list: list.slice(start, start + pageSize),
			total,
			page,
			pageSize
		}
	}
}
