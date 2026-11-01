'use strict'
/**
 * 回访功能调试工具（只在调试期用，不接生产业务）
 *
 * 入参 action：
 *   diagnose    诊断：各表数据量、每条规则为什么命中/没命中、模型 Key 是否配置
 *   seed        造 4 个客户，分别命中 R1/R2/R3/R7（打 debugSeed 标记）
 *   clear       删掉 seed 造的测试数据，以及它产生的任务/话术/日志
 *   test_model  直接试一次大模型调用，验证 DASHSCOPE_API_KEY 是否可用
 *
 * 用法：HBuilderX 里右键 followup_debug → 上传并运行，
 *      参数 {"userId":"你的user._id","action":"diagnose"}
 */
const db = uniCloud.database()
const dbCmd = db.command
const DAY = 86400000

const RULES = {
	R1: { code: 'R1', label: '保险到期', windowDays: 30, cooldownDays: 180 },
	R2: { code: 'R2', label: '流失挽回', gapDays: 90, minOrders: 2, cooldownDays: 90 },
	R3: { code: 'R3', label: '余额闲置', balance: 200, gapDays: 90, cooldownDays: 60 },
	R7: { code: 'R7', label: '次卡余量', remainMax: 1, gapDays: 60, cooldownDays: 45 }
}

function fail(code, message) {
	return { code, status: 'error', message }
}

async function getOperator(event) {
	const userId = String(event.userId || '')
	if (!userId) return { error: fail(401, '请先登录（参数里要有 userId）') }
	const res = await db.collection('user').doc(userId).get()
	const user = (res.data || [])[0]
	if (!user) return { error: fail(401, '用户不存在，userId 填错了') }
	if (user.status === 0 || user.status === false) return { error: fail(403, '账号已停用') }
	if (!user.enterpriseId) return { error: fail(403, '账号未绑定门店（user.enterpriseId 为空）') }
	return { user, enterpriseId: user.enterpriseId }
}

async function fetchAll(collection, where, field, pageSize = 500) {
	const out = []
	let skip = 0
	for (let i = 0; i < 40; i++) {
		let query = (where && Object.keys(where).length)
			? db.collection(collection).where(where)
			: db.collection(collection)
		if (field) query = query.field(field)
		const res = await query.skip(skip).limit(pageSize).get()
		const list = res.data || []
		for (let j = 0; j < list.length; j++) out.push(list[j])
		if (list.length < pageSize) break
		skip += pageSize
	}
	return out
}

function fmtDate(ts) {
	if (!ts) return ''
	const d = new Date(Number(ts))
	const m = String(d.getMonth() + 1).padStart(2, '0')
	const day = String(d.getDate()).padStart(2, '0')
	return `${d.getFullYear()}-${m}-${day}`
}

async function diagnose(enterpriseId) {
	const [enterpriseRes, members, cars, orders, cardItems, tasks, scripts] = await Promise.all([
		db.collection('enterprise').doc(enterpriseId).get().catch(() => ({ data: [] })),
		fetchAll('member', { enterpriseId }),
		fetchAll('car_info', { enterpriseId }),
		fetchAll('order', { enterpriseId }, { carInfoId: true, memberId: true, time: true, status: true }),
		fetchAll('member_card_item', { enterpriseId }),
		fetchAll('followup_task', { enterpriseId }),
		fetchAll('followup_script', { enterpriseId })
	])

	const now = Date.now()
	const memberMap = {}
	members.forEach(m => { memberMap[m._id] = m })

	// 到店统计（与 followup_scan 口径一致：入账订单才计数，任何订单都算最近到店时间）
	const stat = {}
	orders.forEach(o => {
		if (o.carInfoId) {
			const k = 'car:' + o.carInfoId
			if (!stat[k]) stat[k] = { count: 0, lastTime: 0 }
			if (Number(o.status) === 2) stat[k].count++
			if (Number(o.time) > stat[k].lastTime) stat[k].lastTime = Number(o.time)
		}
		if (o.memberId) {
			const k = 'member:' + o.memberId
			if (!stat[k]) stat[k] = { count: 0, lastTime: 0 }
			if (Number(o.status) === 2) stat[k].count++
			if (Number(o.time) > stat[k].lastTime) stat[k].lastTime = Number(o.time)
		}
	})

	// 同规则/客户最近任务 → 冷却期判断；近 30 天任务数 → 2 条上限判断
	const lastByKey = {}
	const recentByCustomer = {}
	tasks.forEach(t => {
		const customerKey = t.memberId || ('car:' + t.carId)
		const key = t.ruleCode + '|' + customerKey
		lastByKey[key] = Math.max(lastByKey[key] || 0, Number(t.createdAt) || 0)
		if (Number(t.createdAt) > now - 30 * DAY) {
			recentByCustomer[customerKey] = (recentByCustomer[customerKey] || 0) + 1
		}
	})

	function add(map, key) {
		map[key] = (map[key] || 0) + 1
	}

	// 返回 true 表示被"冷却期"或"30 天 2 条上限"挡住，并记录原因
	function blockedByLimit(rule, customerKey, map) {
		const last = lastByKey[rule.code + '|' + customerKey] || 0
		if (last && now - last < rule.cooldownDays * DAY) {
			add(map, `同规则冷却期内（${rule.cooldownDays} 天）`)
			return true
		}
		if ((recentByCustomer[customerKey] || 0) >= 2) {
			add(map, '客户 30 天内已有 2 条任务（防骚扰上限）')
			return true
		}
		return false
	}

	// R1 保险到期
	const r1 = { eligible: 0, blocked: {} }
	cars.forEach(car => {
		if (!car.insure) return add(r1.blocked, '车辆没填保险到期时间')
		const leftDays = Math.floor((Number(car.insure) - now) / DAY)
		if (leftDays < 0) return add(r1.blocked, '保险已过期（' + (-leftDays) + ' 天前）')
		if (leftDays > RULES.R1.windowDays) return add(r1.blocked, '保险到期还早（>30 天）')
		const member = car.memberId ? memberMap[car.memberId] : null
		if (member && member.consentMarketing === false) return add(r1.blocked, '会员关闭了营销授权')
		if (blockedByLimit(RULES.R1, car.memberId || ('car:' + car._id), r1.blocked)) return
		r1.eligible++
	})

	// R2 流失挽回
	const r2 = { eligible: 0, blocked: {} }
	members.forEach(member => {
		if (member.status !== 1) return add(r2.blocked, '会员已停用')
		if (member.consentMarketing === false) return add(r2.blocked, '会员关闭了营销授权')
		const s = stat['member:' + member._id] || { count: 0, lastTime: 0 }
		if (!s.lastTime) return add(r2.blocked, '该会员没有关联订单（订单没写 memberId）')
		if (s.count < RULES.R2.minOrders) return add(r2.blocked, '已入账订单不足 2 单')
		const gap = Math.floor((now - s.lastTime) / DAY)
		if (gap <= RULES.R2.gapDays) return add(r2.blocked, '90 天内刚来过')
		if (blockedByLimit(RULES.R2, member._id, r2.blocked)) return
		r2.eligible++
	})

	// R3 余额闲置
	const r3 = { eligible: 0, blocked: {} }
	members.forEach(member => {
		if (member.status !== 1) return add(r3.blocked, '会员已停用')
		if (member.consentMarketing === false) return add(r3.blocked, '会员关闭了营销授权')
		const balance = Number(member.balance || 0)
		if (balance < RULES.R3.balance) return add(r3.blocked, '储值余额不足 200 元')
		const s = stat['member:' + member._id] || { count: 0, lastTime: 0 }
		const gap = s.lastTime
			? Math.floor((now - s.lastTime) / DAY)
			: Math.floor((now - Number(member.createTime || now)) / DAY)
		if (gap <= RULES.R3.gapDays) return add(r3.blocked, '90 天内来过')
		if (blockedByLimit(RULES.R3, member._id, r3.blocked)) return
		r3.eligible++
	})

	// R7 次卡余量
	const r7 = { eligible: 0, blocked: {} }
	if (!cardItems.length) add(r7.blocked, '一条次卡权益都没有（member_card_item 为空）')
	cardItems.forEach(item => {
		const member = memberMap[item.memberId]
		if (!member) return add(r7.blocked, '次卡没有关联到会员')
		if (member.status !== 1) return add(r7.blocked, '会员已停用')
		const remaining = Number(item.remainingTimes || 0)
		if (remaining <= 0) return add(r7.blocked, '卡里次数已用完')
		if (remaining > RULES.R7.remainMax) return add(r7.blocked, '剩余次数还多（>1 次）')
		if (item.expireAt && Number(item.expireAt) < now) return add(r7.blocked, '次卡已过期')
		const lastUsed = Number(item.lastUsedAt || 0)
		const gap = lastUsed ? Math.floor((now - lastUsed) / DAY) : 999
		if (gap <= RULES.R7.gapDays) return add(r7.blocked, '60 天内刚核销过')
		if (blockedByLimit(RULES.R7, member._id, r7.blocked)) return
		r7.eligible++
	})

	const hints = []
	if (!members.length) hints.push('会员表为空：先在「会员开卡」建一个会员，或调 action=seed 造测试数据')
	if (!cars.length) hints.push('车辆表为空：R1 保险到期靠 car_info.insure 触发')
	if (!orders.length) hints.push('订单表为空：R2 流失挽回需要至少 2 笔已入账（status=2）订单')
	if (!cardItems.length) hints.push('次卡表为空：去会员详情开一张次卡，剩余次数改到 1、lastUsedAt 改到 60 天前')
	if (!tasks.length && (r1.eligible + r2.eligible + r3.eligible + r7.eligible) === 0) {
		hints.push('四条规则全被阈值挡掉：先用 action=seed 验证链路，再回头调 followup_scan 里的 RULES 阈值')
	}
	if (!process.env.DASHSCOPE_API_KEY) {
		hints.push('未配 DASHSCOPE_API_KEY：话术走模板（source=template），功能可用但没有 AI 味')
	}

	return {
		enterprise: {
			id: enterpriseId,
			name: ((enterpriseRes.data || [])[0] || {}).name || ''
		},
		counts: {
			member: members.length,
			car: cars.length,
			order: orders.length,
			memberCardItem: cardItems.length,
			followupTask: tasks.length,
			followupScript: scripts.length
		},
		model: {
			hasKey: !!process.env.DASHSCOPE_API_KEY,
			model: process.env.FOLLOWUP_MODEL || 'qwen-plus'
		},
		rules: [
			{ code: 'R1', label: RULES.R1.label, eligible: r1.eligible, blocked: r1.blocked },
			{ code: 'R2', label: RULES.R2.label, eligible: r2.eligible, blocked: r2.blocked },
			{ code: 'R3', label: RULES.R3.label, eligible: r3.eligible, blocked: r3.blocked },
			{ code: 'R7', label: RULES.R7.label, eligible: r7.eligible, blocked: r7.blocked }
		],
		hints,
		today: fmtDate(now)
	}
}

/**
 * 造 4 个客户，每个只命中一条规则
 * 原因：扫描有"同一客户 30 天内最多 2 条"的上限，一个客户命中 4 条规则只会出 2 条任务，
 *       拆成 4 个客户才能一条一条验证。
 */
async function seed(event, enterpriseId) {
	await clear(enterpriseId)
	const now = Date.now()
	const suffix = String(now).slice(-6)
	const operatorUserId = String(event.operatorUserId || '')
	const made = []
	// 11 位手机号，四个客户各不重复；姓名用真名格式，扫描后称呼会算成 王姐/李哥/张姐/赵哥
	const phoneOf = i => '139' + suffix.slice(0, 5) + '00' + i

	async function addMember(opts) {
		const res = await db.collection('member').add({
			enterpriseId,
			cardNo: opts.cardNo,
			name: opts.name,
			phone: opts.phone,
			level: '金卡会员',
			gender: opts.gender,
			birthday: opts.birthday || '',
			balance: opts.balance || 0,
			totalRecharge: opts.totalRecharge || 0,
			totalConsume: opts.totalConsume || 0,
			status: 1,
			remark: '调试数据，可一键清除',
			consentMarketing: true,
			creatorUserId: operatorUserId,
			createTime: opts.createTime || (now - 400 * DAY),
			updateTime: now,
			debugSeed: true
		})
		return res.id
	}

	async function addCar(memberId, opts) {
		const doc = {
			enterpriseId,
			memberId,
			carNumber: opts.carNumber,
			owner: opts.owner,
			ownerphone: opts.phone,
			brand: opts.brand || '大众',
			carType: opts.carType || '迈腾',
			debugSeed: true
		}
		// 没给保险到期时间就不写这个字段，避免空值影响 R1 判断
		if (opts.insure) doc.insure = opts.insure
		const res = await db.collection('car_info').add(doc)
		return res.id
	}

	// 客户 A：只命中 R1 保险到期（20 天后到期，无订单）
	const phoneA = phoneOf(1)
	const memberA = await addMember({
		cardNo: 'DBGA' + suffix,
		name: '王丽',
		phone: phoneA,
		gender: 2,
		birthday: '05-20',
		balance: 0
	})
	const carA = await addCar(memberA, {
		carNumber: '京N1' + suffix.slice(-4),
		owner: '王丽',
		phone: phoneA,
		insure: now + 20 * DAY
	})
	made.push({ 规则: 'R1 保险到期', 客户: '王丽（女）', 依据: '保险 ' + fmtDate(now + 20 * DAY) + ' 到期（20 天后）' })

	// 客户 B：只命中 R2 流失挽回（2 笔入账，最后一笔 120 天前）
	const phoneB = phoneOf(2)
	const memberB = await addMember({
		cardNo: 'DBGB' + suffix,
		name: '李强',
		phone: phoneB,
		gender: 1,
		balance: 0,
		totalConsume: 1800
	})
	const carB = await addCar(memberB, {
		carNumber: '京N2' + suffix.slice(-4),
		owner: '李强',
		phone: phoneB
	})
	await db.collection('order').add({
		enterpriseId, memberId: memberB, carInfoId: carB, time: now - 150 * DAY, status: 2, debugSeed: true
	})
	await db.collection('order').add({
		enterpriseId, memberId: memberB, carInfoId: carB, time: now - 120 * DAY, status: 2, debugSeed: true
	})
	made.push({ 规则: 'R2 流失挽回', 客户: '李强（男）', 依据: '2 笔入账，最后一笔 120 天前' })

	// 客户 C：只命中 R3 余额闲置（余额 800，开卡 300 天前，无订单）
	const phoneC = phoneOf(3)
	const memberC = await addMember({
		cardNo: 'DBGC' + suffix,
		name: '张敏',
		phone: phoneC,
		gender: 2,
		balance: 800,
		totalConsume: 2600,
		createTime: now - 300 * DAY
	})
	await addCar(memberC, {
		carNumber: '京N3' + suffix.slice(-4),
		owner: '张敏',
		phone: phoneC
	})
	made.push({ 规则: 'R3 余额闲置', 客户: '张敏（女）', 依据: '余额 800 元，300 天没到店' })

	// 客户 D：只命中 R7 次卡余量（剩 1 次，120 天未核销）
	const phoneD = phoneOf(4)
	const memberD = await addMember({
		cardNo: 'DBGD' + suffix,
		name: '赵刚',
		phone: phoneD,
		gender: 1,
		balance: 0,
		totalConsume: 3200
	})
	const carD = await addCar(memberD, {
		carNumber: '京N4' + suffix.slice(-4),
		owner: '赵刚',
		phone: phoneD
	})
	const cardRes = await db.collection('member_card').add({
		enterpriseId,
		memberId: memberD,
		cardNo: 'DBGCARD' + suffix,
		cardName: '保养三次卡',
		cardType: 1,
		totalTimes: 3,
		usedTimes: 2,
		remainingTimes: 1,
		amount: 900,
		expireAt: now + 180 * DAY,
		status: 1,
		remark: '调试数据',
		creatorUserId: operatorUserId,
		createTime: now - 120 * DAY,
		updateTime: now,
		debugSeed: true
	})
	await db.collection('member_card_item').add({
		enterpriseId,
		cardId: cardRes.id,
		memberId: memberD,
		goodsName: '小保养（全合成）',
		totalTimes: 3,
		usedTimes: 2,
		remainingTimes: 1,
		expireAt: now + 180 * DAY,
		lastUsedAt: now - 120 * DAY,
		status: 1,
		createTime: now - 120 * DAY,
		updateTime: now,
		debugSeed: true
	})
	made.push({ 规则: 'R7 次卡余量', 客户: '赵刚（男）', 依据: '小保养剩 1 次，120 天未核销' })

	return {
		customers: made,
		memberIds: [memberA, memberB, memberC, memberD],
		note: '已造 4 个客户分别命中 R1/R2/R3/R7，去「AI 回访」点刷新名单，预期新增 4 条任务；验证完用 action=clear 清理'
	}
}

async function clear(enterpriseId) {
	const result = {}
	const seededMembers = await fetchAll('member', { enterpriseId, debugSeed: true }, { _id: true })
	const memberIds = seededMembers.map(m => m._id)

	// 先删这些会员产生的任务、话术、日志
	if (memberIds.length) {
		const tasks = await fetchAll('followup_task', {
			enterpriseId,
			memberId: dbCmd.in(memberIds)
		}, { _id: true })
		const taskIds = tasks.map(t => t._id)
		if (taskIds.length) {
			await db.collection('followup_script').where({ enterpriseId, taskId: dbCmd.in(taskIds) }).remove()
			await db.collection('followup_log').where({ enterpriseId, taskId: dbCmd.in(taskIds) }).remove()
			const removed = await db.collection('followup_task').where({ enterpriseId, _id: dbCmd.in(taskIds) }).remove()
			result.followup_task = removed.deleted || 0
		}
	}

	const collections = ['member_card_item', 'member_card', 'order', 'car_info', 'member']
	for (let i = 0; i < collections.length; i++) {
		const name = collections[i]
		const res = await db.collection(name).where({ enterpriseId, debugSeed: true }).remove()
		result[name] = res.deleted || 0
	}
	return result
}

async function testModel() {
	const apiKey = process.env.DASHSCOPE_API_KEY
	if (!apiKey) return { ok: false, message: '未配置 DASHSCOPE_API_KEY 环境变量' }
	const started = Date.now()
	try {
		const res = await uniCloud.httpclient.request('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: 'Bearer ' + apiKey
			},
			data: {
				model: process.env.FOLLOWUP_MODEL || 'qwen-plus',
				max_tokens: 32,
				messages: [{ role: 'user', content: '只回复两个字：收到' }]
			},
			contentType: 'json',
			dataType: 'json',
			timeout: 15000
		})
		const data = res.data || {}
		const content = data.choices && data.choices[0] ? data.choices[0].message.content : ''
		return {
			ok: !!content,
			costMs: Date.now() - started,
			reply: content,
			message: content ? '模型可用' : '模型返回异常: ' + JSON.stringify(data).slice(0, 200)
		}
	} catch (err) {
		return { ok: false, costMs: Date.now() - started, message: '调用失败: ' + ((err && err.message) || 'unknown') }
	}
}

exports.main = async (event, context) => {
	const source = event || {}
	const action = String(source.action || 'diagnose')

	const auth = await getOperator(source)
	if (auth.error) return auth.error
	const enterpriseId = auth.enterpriseId

	try {
		if (action === 'diagnose') {
			return { code: 200, status: 'success', data: await diagnose(enterpriseId) }
		}
		if (action === 'seed') {
			return { code: 200, status: 'success', data: await seed(source, enterpriseId) }
		}
		if (action === 'clear') {
			return { code: 200, status: 'success', data: await clear(enterpriseId) }
		}
		if (action === 'test_model') {
			return { code: 200, status: 'success', data: await testModel() }
		}
		return fail(400, '未知 action：' + action + '，可选 diagnose / seed / clear / test_model')
	} catch (err) {
		return fail(500, '调试执行失败：' + ((err && err.message) || 'unknown'))
	}
}
