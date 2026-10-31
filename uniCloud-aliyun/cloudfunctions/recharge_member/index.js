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

async function duplicateResult(enterpriseId, txId) {
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

exports.main = async (event, context) => {
	const auth = await getOperator(event)
	if (auth.error) return auth.error

	const memberId = String(event.memberId || '')
	const amount = Number(event.amount)
	const idempotencyKey = String(event.idempotencyKey || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
	if (!memberId) return fail(400, '缺少会员ID')
	if (!Number.isInteger(amount) || amount <= 0) return fail(400, '充值金额必须是正整数')
	if (!idempotencyKey) return fail(400, '缺少幂等键')

	const txId = 'mt_' + auth.enterpriseId + '_' + idempotencyKey
	const duplicated = await duplicateResult(auth.enterpriseId, txId)
	if (duplicated) return duplicated

	const transaction = await db.startTransaction()
	try {
		const memberRes = await transaction.collection('member').doc(memberId).get()
		const member = (memberRes.data || [])[0]
		if (!member || member.enterpriseId !== auth.enterpriseId) throw new Error('会员不存在')
		if (Number(member.status) !== 1) throw new Error('会员已禁用')

		const balanceBefore = Number(member.balance || 0)
		const balanceAfter = balanceBefore + amount
		const now = Date.now()

		await transaction.collection('member').doc(memberId).update({
			balance: dbCmd.inc(amount),
			totalRecharge: dbCmd.inc(amount),
			updateTime: now
		})
		await transaction.collection('member_transactions').add({
			_id: txId,
			enterpriseId: auth.enterpriseId,
			memberId,
			type: 'recharge',
			amount,
			balanceBefore,
			balanceAfter,
			payType: parseInt(event.payType) || 0,
			operatorUserId: auth.user._id,
			remark: String(event.remark || '').trim(),
			idempotencyKey,
			time: now
		})
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
		const existing = await duplicateResult(auth.enterpriseId, txId)
		if (existing) return existing
		return fail(409, e.message || '充值失败')
	}
}
