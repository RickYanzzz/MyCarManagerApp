'use strict';
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

async function duplicateResult(txId) {
	const txRes = await db.collection('member_transactions').doc(txId).get()
	const tx = (txRes.data || [])[0]
	if (!tx) return null
	const memberRes = await db.collection('member').doc(tx.memberId).get()
	const member = (memberRes.data || [])[0] || {}
	return {
		code: 200,
		status: 'success',
		data: {
			duplicated: true,
			transactionId: txId,
			balance: Number(member.balance || tx.balanceAfter || 0)
		}
	}
}

async function sumFee(collection, enterpriseId, orderId) {
	const res = await db.collection(collection).where({ enterpriseId, orderId }).get()
	return (res.data || []).reduce((total, item) => total + (Number(item.fee) || 0), 0)
}

exports.main = async (event, context) => {
	const auth = await getOperator(event)
	if (auth.error) return auth.error

	const memberId = String(event.memberId || '')
	const orderId = String(event.orderId || '')
	const amount = Number(event.amount)
	const idempotencyKey = String(event.idempotencyKey || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
	if (!memberId) return fail(400, '缺少会员ID')
	if (!orderId) return fail(400, '缺少订单ID')
	if (!Number.isInteger(amount) || amount <= 0) return fail(400, '支付金额必须是正整数')
	if (!idempotencyKey) return fail(400, '缺少幂等键')

	const txId = 'mt_' + auth.enterpriseId + '_' + idempotencyKey
	const duplicated = await duplicateResult(txId)
	if (duplicated) return duplicated

	const orderRes = await db.collection('order').doc(orderId).get()
	const order = (orderRes.data || [])[0]
	if (!order || order.enterpriseId !== auth.enterpriseId) return fail(404, '订单不存在')
	if (Number(order.status) === 2) return fail(409, '订单已入账')
	if (order.memberId && order.memberId !== memberId) return fail(409, '订单已绑定其他会员')

	const totalFee = await sumFee('purchased_goods', auth.enterpriseId, orderId)
	const payFee = await sumFee('pay_infos', auth.enterpriseId, orderId)
	const oweFee = totalFee - payFee
	if (oweFee <= 0) return fail(409, '订单已无未付金额')
	if (amount > oweFee) return fail(409, '支付金额超过未付金额')

	const carId = String(event.carId || order.carInfoId || '')
	const transaction = await db.startTransaction()
	try {
		const memberRes = await transaction.collection('member').doc(memberId).get()
		const member = (memberRes.data || [])[0]
		if (!member || member.enterpriseId !== auth.enterpriseId) throw new Error('会员不存在')
		if (Number(member.status) !== 1) throw new Error('会员已禁用')

		const balanceBefore = Number(member.balance || 0)
		if (balanceBefore < amount) throw new Error('会员余额不足')
		const balanceAfter = balanceBefore - amount
		const now = Date.now()

		const txOrderRes = await transaction.collection('order').doc(orderId).get()
		const txOrder = (txOrderRes.data || [])[0]
		if (!txOrder || Number(txOrder.status) === 2) throw new Error('订单状态已变更，请刷新后重试')
		if (txOrder.memberId && txOrder.memberId !== memberId) throw new Error('订单已绑定其他会员')

		await transaction.collection('member').doc(memberId).update({
			balance: dbCmd.inc(-amount),
			totalConsume: dbCmd.inc(amount),
			updateTime: now
		})
		await transaction.collection('member_transactions').add({
			_id: txId,
			enterpriseId: auth.enterpriseId,
			memberId,
			type: 'consume',
			amount,
			balanceBefore,
			balanceAfter,
			payType: 0,
			orderId,
			carId,
			operatorUserId: auth.user._id,
			remark: String(event.remark || '').trim(),
			idempotencyKey,
			time: now
		})
		await transaction.collection('pay_infos').add({
			userId: auth.user._id,
			enterpriseId: auth.enterpriseId,
			memberId,
			name: '会员卡',
			type: 0,
			fee: amount,
			orderId,
			carId
		})
		if (!txOrder.memberId) {
			await transaction.collection('order').doc(orderId).update({ memberId })
		}
		await transaction.commit()

		return {
			code: 200,
			status: 'success',
			data: { balance: balanceAfter, transactionId: txId }
		}
	} catch (e) {
		try {
			await transaction.rollback()
		} catch (rollbackErr) {}
		const existing = await duplicateResult(txId)
		if (existing) return existing
		return fail(409, e.message || '会员卡支付失败')
	}
}
