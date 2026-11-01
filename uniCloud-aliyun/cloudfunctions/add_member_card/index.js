'use strict'
/**
 * 给会员开一张次卡 / 套餐卡
 *
 * 入参：
 *   memberId   会员ID
 *   cardName   卡名称，如「保养 3 次卡」
 *   cardType   1 次卡；2 套餐卡
 *   amount     售卡金额
 *   expireAt   有效期时间戳，可空
 *   items      [{ goodsId, goodsName, totalTimes, expireAt }]
 *   remark     备注
 *
 * 说明：售卡金额不计入储值余额，只做统计；核销由开单流程处理（P1）。
 */
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
	const cardName = String(event.cardName || '').trim()
	const items = Array.isArray(event.items) ? event.items : []
	if (!memberId) return fail(400, '缺少会员ID')
	if (!cardName) return fail(400, '请填写卡名称')
	if (!items.length) return fail(400, '至少添加一个项目')

	const memberRes = await db.collection('member').doc(memberId).get()
	const member = (memberRes.data || [])[0]
	if (!member) return fail(404, '会员不存在')
	if (member.enterpriseId !== auth.enterpriseId) return fail(403, '无权操作该会员')

	const now = Date.now()
	let totalTimes = 0
	const itemDocs = []
	for (let i = 0; i < items.length; i++) {
		const item = items[i]
		const times = Math.max(1, parseInt(item.totalTimes) || 1)
		const goodsName = String(item.goodsName || '').trim()
		if (!goodsName) continue
		totalTimes += times
		itemDocs.push({
			enterpriseId: auth.enterpriseId,
			memberId,
			goodsId: String(item.goodsId || ''),
			goodsName,
			totalTimes: times,
			usedTimes: 0,
			remainingTimes: times,
			expireAt: Number(item.expireAt) || Number(event.expireAt) || null,
			lastUsedAt: null,
			status: 1,
			createTime: now,
			updateTime: now
		})
	}
	if (!itemDocs.length) return fail(400, '项目名称不能为空')

	const card = {
		enterpriseId: auth.enterpriseId,
		memberId,
		cardNo: String(event.cardNo || ''),
		cardName,
		cardType: parseInt(event.cardType) === 2 ? 2 : 1,
		totalTimes,
		usedTimes: 0,
		remainingTimes: totalTimes,
		amount: Number(event.amount) || 0,
		expireAt: Number(event.expireAt) || null,
		status: 1,
		sourceOrderId: String(event.sourceOrderId || ''),
		remark: String(event.remark || ''),
		creatorUserId: auth.user._id,
		createTime: now,
		updateTime: now
	}

	const cardRes = await db.collection('member_card').add(card)
	card._id = cardRes.id

	for (let i = 0; i < itemDocs.length; i++) {
		itemDocs[i].cardId = card._id
		await db.collection('member_card_item').add(itemDocs[i])
	}

	return { code: 200, status: 'success', data: { card, items: itemDocs } }
}
