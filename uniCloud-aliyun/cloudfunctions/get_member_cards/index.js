'use strict'
/**
 * 查询会员的次卡 / 套餐卡及权益明细
 * 入参：memberId（必填）
 */
const db = uniCloud.database()
const dbCmd = db.command

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

	const cardRes = await db.collection('member_card')
		.where({ enterpriseId: auth.enterpriseId, memberId })
		.orderBy('createTime', 'desc')
		.get()
	const cards = cardRes.data || []
	if (!cards.length) return { code: 200, status: 'success', data: { list: [] } }

	const ids = cards.map(c => c._id)
	const itemRes = await db.collection('member_card_item')
		.where({ enterpriseId: auth.enterpriseId, cardId: dbCmd.in(ids) })
		.get()
	const items = itemRes.data || []

	const itemMap = {}
	items.forEach(item => {
		if (!itemMap[item.cardId]) itemMap[item.cardId] = []
		itemMap[item.cardId].push(item)
	})

	const list = cards.map(card => Object.assign({}, card, {
		items: itemMap[card._id] || []
	}))

	return { code: 200, status: 'success', data: { list } }
}
