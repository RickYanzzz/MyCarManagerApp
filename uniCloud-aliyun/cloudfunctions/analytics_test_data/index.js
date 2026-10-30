'use strict'

/**
 * analytics_test_data —— 经营统计模块的隔离测试数据 CRUD
 *
 * 设计原则（对应“测试数据必须与正式门店数据隔离”）：
 * 1. 只操作 analytics_test_order / analytics_test_pay_info 两个专用集合，
 *    集合名是常量白名单，代码里没有任何路径能写到 order / pay_infos。
 * 2. 每条文档都打 __test: true 标记，便于一眼区分、便于整体清理。
 * 3. 字段结构与正式集合完全一致（updateTime / status / fee / type / orderId），
 *    所以 analytics_summary 的聚合管道可以原样复用，source=test 即可切换。
 * 4. 写操作默认关闭：环境变量 ANALYTICS_TEST_DATA_ENABLED 不等于 'on' 时一律 403。
 *
 * 动作（event.action）：
 *   create  新增一条测试订单（可带多笔付款）
 *   list    分页查询（含付款明细）
 *   update  修改订单状态 / 时间
 *   remove  删除订单及其付款记录
 *   clear   清空本门店的全部测试数据
 *   seed    批量生成若干天的测试数据
 *
 * 入参：{ action, userId, ... }
 * 出参：{ code, status, data } 或 { code, status, message }
 */

const db = uniCloud.database()
const dbCmd = db.command

const COL = {
	order: 'analytics_test_order',
	pay: 'analytics_test_pay_info'
}

// 集合名白名单校验：任何情况下都不允许出现白名单以外的集合
const ALLOWED_COLLECTIONS = [COL.order, COL.pay]
ALLOWED_COLLECTIONS.forEach(function (name) {
	if (name.indexOf('analytics_test_') !== 0) {
		throw new Error('非法集合名：' + name)
	}
})

const DAY_MS = 24 * 60 * 60 * 1000
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000
const BATCH_SIZE = 50
const MAX_SEED_DAYS = 90
const GIFT_TYPE = 4

const PAY_LABELS = { 1: '微信', 2: '现金', 3: '支付宝', 4: '赠送', 5: '其他', 6: '银行卡' }

function fail(code, message) {
	return { code: code, status: 'error', message: message }
}

function ok(data) {
	return { code: 200, status: 'success', data: data }
}

// 开关集合：与环境变量等价的“数据库开关”，避免上传函数时云端环境变量被覆盖后失效
const FLAG_COLLECTION = 'app_config'

async function resolveFlag(envName) {
	const envValue = process.env[envName]
	if (envValue === 'on') {
		return { on: true, detail: '' }
	}

	let envNote = '未读到环境变量 ' + envName
	if (typeof envValue === 'string') {
		envNote = '环境变量 ' + envName + ' = ' + JSON.stringify(envValue) + '（不等于 on）'
	}

	try {
		const res = await db.collection(FLAG_COLLECTION).where({ key: envName }).limit(1).get()
		const doc = res.data && res.data[0]
		if (doc) {
			const v = String(doc.value === undefined ? '' : doc.value).trim()
			if (v === 'on') return { on: true, detail: '' }
			return { on: false, detail: envNote + '；app_config 中 value = ' + JSON.stringify(v) + '（不等于 on）' }
		}
		return { on: false, detail: envNote + '；app_config 中也没有 key = ' + envName + ' 的记录' }
	} catch (e) {
		return { on: false, detail: envNote + '；读取 app_config 失败：' + ((e && e.message) || '未知错误') }
	}
}

function toNumber(v, fallback) {
	const n = Number(v)
	return isFinite(n) ? n : fallback
}

function dayStartMs(dayIndex) {
	return dayIndex * DAY_MS - BEIJING_OFFSET_MS
}

function todayDayIndex(nowMs) {
	return Math.floor(((typeof nowMs === 'number' ? nowMs : Date.now()) + BEIJING_OFFSET_MS) / DAY_MS)
}

// 可复现的伪随机，保证同样参数生成的测试数据一致，便于回归比对
function createRandom(seed) {
	let s = seed % 2147483647
	if (s <= 0) s += 2147483646
	return function () {
		s = (s * 16807) % 2147483647
		return (s - 1) / 2147483646
	}
}

function chunk(arr, size) {
	const out = []
	for (let i = 0; i < arr.length; i += size) {
		out.push(arr.slice(i, i + size))
	}
	return out
}

/** 服务端解析门店：忽略客户端传的 enterpriseId */
async function resolveEnterprise(userId) {
	if (!userId) {
		return { error: fail(401, '缺少 userId，无法校验门店权限') }
	}
	const res = await db.collection('user').doc(userId).get()
	const user = res.data && res.data[0]
	if (!user) {
		return { error: fail(401, '用户不存在') }
	}
	const st = user.status
	if (st === false || st === 0 || st === '0') {
		return { error: fail(403, '账号已停用') }
	}
	if (!user.enterpriseId) {
		return { error: fail(403, '该账号未绑定门店') }
	}
	return { enterpriseId: user.enterpriseId }
}

/* ---------------- 各动作实现 ---------------- */

async function doCreate(event, userId, enterpriseId) {
	const now = Date.now()
	const updateTime = toNumber(event.updateTime, now)
	const status = toNumber(event.status, 2)
	const carInfoId = event.carInfoId || ('test_car_' + Math.random().toString(36).slice(2, 10))

	const orderDoc = {
		__test: true,
		userId: userId,
		enterpriseId: enterpriseId,
		carInfoId: carInfoId,
		time: toNumber(event.time, updateTime),
		updateTime: updateTime,
		status: status
	}

	const orderRes = await db.collection(COL.order).add(orderDoc)
	const orderId = orderRes.id || (orderRes.ids && orderRes.ids[0])
	if (!orderId) {
		return fail(500, '测试订单写入失败')
	}

	const pays = Array.isArray(event.pays) ? event.pays : []
	const payDocs = []
	for (let i = 0; i < pays.length; i++) {
		const p = pays[i] || {}
		const type = toNumber(p.type, 1)
		const fee = toNumber(p.fee, 0)
		if (fee < 0) continue
		payDocs.push({
			__test: true,
			userId: userId,
			enterpriseId: enterpriseId,
			name: p.name || PAY_LABELS[type] || '其他',
			type: type,
			fee: fee,
			orderId: orderId,
			carId: carInfoId
		})
	}
	if (payDocs.length > 0) {
		await db.collection(COL.pay).add(payDocs)
	}

	return ok({ _id: orderId, payCount: payDocs.length })
}

async function doList(event, enterpriseId) {
	const page = Math.max(1, toNumber(event.page, 1))
	const pageSize = Math.min(50, Math.max(1, toNumber(event.pageSize, 20)))
	const where = { __test: true, enterpriseId: enterpriseId }

	const countRes = await db.collection(COL.order).where(where).count()
	const listRes = await db.collection(COL.order)
		.where(where)
		.orderBy('updateTime', 'desc')
		.skip((page - 1) * pageSize)
		.limit(pageSize)
		.get()

	const orders = listRes.data || []
	let payMap = {}
	if (orders.length > 0) {
		const ids = orders.map(function (o) { return o._id })
		const payRes = await db.collection(COL.pay)
			.where({ __test: true, orderId: dbCmd.in(ids) })
			.get()
		const pays = payRes.data || []
		for (let i = 0; i < pays.length; i++) {
			const p = pays[i]
			if (!payMap[p.orderId]) payMap[p.orderId] = []
			payMap[p.orderId].push(p)
		}
	}

	const list = orders.map(function (o) {
		return {
			_id: o._id,
			status: o.status,
			updateTime: o.updateTime,
			time: o.time,
			carInfoId: o.carInfoId,
			pays: payMap[o._id] || []
		}
	})

	return ok({ page: page, pageSize: pageSize, total: countRes.total || 0, list: list })
}

async function doUpdate(event, enterpriseId) {
	if (!event._id) return fail(400, '缺少 _id')
	const patch = {}
	if (event.status !== undefined) patch.status = toNumber(event.status, 2)
	if (event.updateTime !== undefined) patch.updateTime = toNumber(event.updateTime, Date.now())
	if (Object.keys(patch).length === 0) {
		return fail(400, '没有需要更新的字段（只支持 status / updateTime）')
	}
	const res = await db.collection(COL.order)
		.where({ _id: event._id, __test: true, enterpriseId: enterpriseId })
		.update(patch)
	const updated = (res && res.updated) || 0
	if (updated === 0) return fail(404, '测试订单不存在或不属于当前门店')
	return ok({ _id: event._id, updated: updated, patch: patch })
}

async function doRemove(event, enterpriseId) {
	if (!event._id) return fail(400, '缺少 _id')
	const orderRes = await db.collection(COL.order)
		.where({ _id: event._id, __test: true, enterpriseId: enterpriseId })
		.remove()
	const payRes = await db.collection(COL.pay)
		.where({ orderId: event._id, __test: true, enterpriseId: enterpriseId })
		.remove()
	const removedOrder = (orderRes && orderRes.deleted) || 0
	if (removedOrder === 0) return fail(404, '测试订单不存在或不属于当前门店')
	return ok({ _id: event._id, removedOrder: removedOrder, removedPay: (payRes && payRes.deleted) || 0 })
}

async function doClear(enterpriseId) {
	const orderRes = await db.collection(COL.order)
		.where({ __test: true, enterpriseId: enterpriseId })
		.remove()
	const payRes = await db.collection(COL.pay)
		.where({ __test: true, enterpriseId: enterpriseId })
		.remove()
	return ok({
		removedOrder: (orderRes && orderRes.deleted) || 0,
		removedPay: (payRes && payRes.deleted) || 0
	})
}

async function doSeed(event, userId, enterpriseId) {
	const days = Math.min(MAX_SEED_DAYS, Math.max(1, toNumber(event.days, 30)))
	const todayIdx = todayDayIndex()

	// 先清空，避免重复造数叠加
	await db.collection(COL.order).where({ __test: true, enterpriseId: enterpriseId }).remove()
	await db.collection(COL.pay).where({ __test: true, enterpriseId: enterpriseId }).remove()

	const orderDocs = []
	const payDocs = []
	const rand = createRandom(days * 7919 + 13)

	for (let i = 0; i < days; i++) {
		const dayIdx = todayIdx - i
		const closed = rand() < 0.1
		const orderCount = closed ? 0 : 1 + Math.floor(rand() * 4)

		for (let k = 0; k < orderCount; k++) {
			const hourOffset = 9 * 3600000 + Math.floor(rand() * 11 * 3600000)
			const updateTime = dayStartMs(dayIdx) + hourOffset
			const carInfoId = 'test_car_' + dayIdx + '_' + k
			const orderId = 'test_order_' + dayIdx + '_' + k
			const amount = 180 + Math.floor(rand() * 900)

			orderDocs.push({
				// 显式指定 _id，保证下面生成的付款记录 orderId 能对上
				_id: orderId,
				__test: true,
				userId: userId,
				enterpriseId: enterpriseId,
				carInfoId: carInfoId,
				time: updateTime - 3600000,
				updateTime: updateTime,
				status: 2
			})

			// 约 8% 的单有一笔赠送（不计入金额），用来验证赠送剔除逻辑
			if (rand() < 0.08) {
				payDocs.push({
					__test: true,
					userId: userId,
					enterpriseId: enterpriseId,
					name: PAY_LABELS[GIFT_TYPE],
					type: GIFT_TYPE,
					fee: 60,
					orderId: orderId,
					carId: carInfoId
				})
			}

			// 约 15% 的单拆成两笔付款，用来验证“一单多笔不重复计工单”
			if (rand() < 0.15) {
				const part = Math.floor(amount / 2)
				payDocs.push({
					__test: true, userId: userId, enterpriseId: enterpriseId,
					name: PAY_LABELS[1], type: 1, fee: part, orderId: orderId, carId: carInfoId
				})
				payDocs.push({
					__test: true, userId: userId, enterpriseId: enterpriseId,
					name: PAY_LABELS[2], type: 2, fee: amount - part, orderId: orderId, carId: carInfoId
				})
			} else {
				const type = [1, 1, 1, 2, 3, 6][Math.floor(rand() * 6)]
				payDocs.push({
					__test: true, userId: userId, enterpriseId: enterpriseId,
					name: PAY_LABELS[type], type: type, fee: amount, orderId: orderId, carId: carInfoId
				})
			}
		}
	}

	// 分片批量写入
	let insertedOrder = 0
	if (orderDocs.length > 0) {
		const batches = chunk(orderDocs, BATCH_SIZE)
		for (let i = 0; i < batches.length; i++) {
			const r = await db.collection(COL.order).add(batches[i])
			insertedOrder += (r.ids ? r.ids.length : (r.inserted || 0))
		}
	}

	let insertedPay = 0
	if (payDocs.length > 0) {
		const batches = chunk(payDocs, BATCH_SIZE)
		for (let i = 0; i < batches.length; i++) {
			const r = await db.collection(COL.pay).add(batches[i])
			insertedPay += (r.ids ? r.ids.length : (r.inserted || 0))
		}
	}

	return ok({
		days: days,
		insertedOrder: orderDocs.length,
		insertedPay: payDocs.length,
		reportedOrder: insertedOrder,
		reportedPay: insertedPay
	})
}

/* ---------------- 入口 ---------------- */

exports.main = async (event) => {
	const startedAt = Date.now()
	try {
		/* 写操作默认关闭，防止误用 */
		const flag = await resolveFlag('ANALYTICS_TEST_DATA_ENABLED')
		if (!flag.on) {
			console.warn('[analytics_test_data] 拒绝调用：', flag.detail)
			return fail(403, '测试数据接口未启用，已拒绝访问。诊断：' + flag.detail)
		}

		const action = typeof event.action === 'string' ? event.action : ''
		const allowed = ['create', 'list', 'update', 'remove', 'clear', 'seed']
		if (allowed.indexOf(action) < 0) {
			return fail(400, 'action 仅支持 ' + allowed.join(' / '))
		}

		const userId = typeof event.userId === 'string' ? event.userId.trim() : ''
		const resolved = await resolveEnterprise(userId)
		if (resolved.error) return resolved.error
		const enterpriseId = resolved.enterpriseId

		let result
		if (action === 'create') result = await doCreate(event, userId, enterpriseId)
		else if (action === 'list') result = await doList(event, enterpriseId)
		else if (action === 'update') result = await doUpdate(event, enterpriseId)
		else if (action === 'remove') result = await doRemove(event, enterpriseId)
		else if (action === 'clear') result = await doClear(enterpriseId)
		else result = await doSeed(event, userId, enterpriseId)

		if (result.code === 200) {
			result.costMs = Date.now() - startedAt
		}
		return result
	} catch (e) {
		console.error('[analytics_test_data] 执行异常', e)
		return fail(500, '测试数据操作失败：' + ((e && e.message) || '未知错误'))
	}
}
