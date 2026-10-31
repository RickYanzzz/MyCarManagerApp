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

function pad(value, length) {
	return String(value).padStart(length, '0')
}

async function generateCardNo(enterpriseId) {
	const now = new Date()
	const prefix = 'M' + now.getFullYear() + pad(now.getMonth() + 1, 2) + pad(now.getDate(), 2)
	const res = await db.collection('member').where({ enterpriseId }).field({ cardNo: true }).get()
	let max = 0
	(res.data || []).forEach(item => {
		const cardNo = String(item.cardNo || '')
		if (cardNo.indexOf(prefix) === 0) {
			const seq = parseInt(cardNo.slice(prefix.length))
			if (seq > max) max = seq
		}
	})
	for (let i = 0; i < 20; i++) {
		const cardNo = prefix + pad(max + 1 + i, 4)
		const dup = await db.collection('member').where({ enterpriseId, cardNo }).get()
		if (!(dup.data || []).length) return cardNo
	}
	throw new Error('卡号生成失败，请重试')
}

exports.main = async (event, context) => {
	const auth = await getOperator(event)
	if (auth.error) return auth.error

	const name = String(event.name || '').trim()
	const phone = String(event.phone || '').trim()
	const level = String(event.level || '普通会员').trim() || '普通会员'
	const remark = String(event.remark || '').trim()
	if (!name || !phone) return fail(400, '姓名和手机号不能为空')

	const phoneRes = await db.collection('member').where({ enterpriseId: auth.enterpriseId, phone }).get()
	if ((phoneRes.data || []).length) return fail(409, '该手机号已开卡')

	let cardNo = String(event.cardNo || '').trim()
	if (cardNo) {
		const cardRes = await db.collection('member').where({ enterpriseId: auth.enterpriseId, cardNo }).get()
		if ((cardRes.data || []).length) return fail(409, '卡号已存在')
	} else {
		cardNo = await generateCardNo(auth.enterpriseId)
	}

	const now = Date.now()
	const member = {
		enterpriseId: auth.enterpriseId,
		cardNo,
		name,
		phone,
		level,
		balance: 0,
		totalRecharge: 0,
		totalConsume: 0,
		status: 1,
		remark,
		creatorUserId: auth.user._id,
		createTime: now,
		updateTime: now
	}
	const res = await db.collection('member').add(member)
	member._id = res.id
	return { code: 200, status: 'success', data: member }
}
