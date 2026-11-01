/**
 * AI 回访的本地 mock 实现
 *
 * 与 uniCloud-aliyun/cloudfunctions/followup_* 的线上逻辑保持一致：
 *   - followup_scan     R1 保险到期 / R2 流失挽回 / R3 余额闲置 / R7 次卡余量
 *                       含去重（同规则冷却期）与限频（同客户 30 天最多 2 条）
 *   - followup_generate 先尝试调本地 AI 代理（scripts/local-ai-proxy.js），
 *                       不通或校验不过就降级为模板话术；三道闸（数字白名单/禁用词/长度）与线上一致
 *   - followup_list     状态过滤 + 关键词 + 优先级排序 + 挂最新话术
 *   - followup_mark     动作日志 + 状态流转
 *   - followup_debug    diagnose / seed / clear / test_model（mock 版）
 *
 * 注意：规则参数改了要同步改云函数，两边是同一份逻辑的两种实现。
 */
import { loadDb, saveDb, makeId } from './db.js'
import { FOLLOWUP_PROXY_URL } from './config.js'

const DAY = 86400000
const CACHE_DAYS = 7

const RULES = {
	R1: { code: 'R1', label: '保险到期', priority: 90, windowDays: 30, cooldownDays: 180 },
	R2: { code: 'R2', label: '流失挽回', priority: 60, gapDays: 90, minOrders: 2, cooldownDays: 90 },
	R3: { code: 'R3', label: '余额闲置', priority: 55, balance: 200, gapDays: 90, cooldownDays: 60 },
	R7: { code: 'R7', label: '次卡余量', priority: 85, remainMax: 1, gapDays: 60, cooldownDays: 45 }
}

const GLOBAL_BANNED = ['最低', '保证', '绝对', '第一', '包治', '永久', '返现', '全网', '最便宜']

function clone(value) {
	return JSON.parse(JSON.stringify(value))
}

function ok(data) {
	return Promise.resolve({ code: 200, status: 'success', data })
}

function fail(msg) {
	return Promise.reject({ code: -1, msg: msg || '操作失败', message: msg || '操作失败' })
}

function fmtDate(ts) {
	if (!ts) return ''
	const d = new Date(Number(ts))
	const m = String(d.getMonth() + 1).padStart(2, '0')
	const day = String(d.getDate()).padStart(2, '0')
	return `${d.getFullYear()}-${m}-${day}`
}

function suffixOf(gender) {
	if (gender === 1) return '哥'
	if (gender === 2) return '姐'
	return ''
}

function surnameOf(member, car) {
	const name = String((member && member.name) || (car && car.owner) || '').trim()
	return name ? name.slice(0, 1) : ''
}

function phoneOf(member, car) {
	return String((member && member.phone) || (car && car.ownerphone) || '')
}

function valueBonus(totalConsume) {
	const amount = Number(totalConsume || 0)
	if (amount >= 5000) return 10
	if (amount >= 2000) return 5
	return 0
}

/* ---------------- 事实卡 / 任务（与 followup_scan 云函数一致） ---------------- */

function buildFact(rule, ctx, store) {
	const { member, car, lastOrderTime, orderCount, lastAmount, cardItem, reason } = ctx
	const surname = surnameOf(member, car)
	const suffix = suffixOf(member && member.gender)
	const gapDays = lastOrderTime ? Math.floor((Date.now() - lastOrderTime) / DAY) : null
	const fact = {
		customer: {
			姓: surname || '客户',
			称谓: suffix,
			称呼: surname ? surname + (suffix || '先生/女士') : '客户',
			等级: (member && member.level) || '',
			会员月龄: member && member.createTime ? Math.floor((Date.now() - member.createTime) / (DAY * 30)) : null
		},
		car: {
			品牌: (car && car.brand) || '',
			车型: (car && car.carType) || '',
			车牌尾号: car && car.carNumber ? String(car.carNumber).slice(-1) : ''
		},
		history: {
			上次到店: fmtDate(lastOrderTime),
			距今天数: gapDays,
			累计到店: orderCount || 0,
			上次消费金额: lastAmount || 0
		},
		trigger: { 规则: rule.code, 原因: reason, 可提权益: '' },
		store: {
			名称: (store && store.name) || '',
			电话: (store && store.phone) || '',
			地址: (store && store.address) || ''
		},
		style: {
			语气: '亲切、口语化，像店里师傅跟老客户聊天',
			长度: '80-110 字',
			禁用词: ['最低', '保证', '绝对', '第一', '包治', '永久']
		}
	}
	if (member && Number(member.balance) > 0) fact.history.储值余额 = Number(member.balance)
	if (cardItem) fact.history.次卡 = { 项目: cardItem.goodsName, 剩余次数: Number(cardItem.remainingTimes || 0) }
	if (car && car.insure) fact.car.保险到期 = fmtDate(car.insure)
	return fact
}

function buildTask(enterpriseId, rule, ctx, fact) {
	const now = Date.now()
	return {
		_id: makeId('ftask'),
		enterpriseId,
		memberId: (ctx.member && ctx.member._id) || '',
		carId: (ctx.car && ctx.car._id) || '',
		contactName: fact.customer.称呼,
		contactPhone: phoneOf(ctx.member, ctx.car),
		ruleCode: rule.code,
		ruleLabel: rule.label,
		priority: Math.min(100, rule.priority + valueBonus(ctx.member && ctx.member.totalConsume)),
		reason: ctx.reason,
		factSnapshot: fact,
		status: 'pending',
		dueDate: now,
		consentAt: now,
		createdAt: now,
		updatedAt: now
	}
}

function hasConsent(member) {
	if (!member) return true
	return member.consentMarketing !== false
}

/* ---------------- 回访演示数据 ----------------
 * 4 个演示客户，各命中一条规则。首次扫描时自动补齐，幂等（按 _id 判断）。
 * 与云函数 followup_debug 的 seed 数据同名同结构，方便对照。
 */
function ts(daysAgo) {
	return Date.now() - daysAgo * DAY
}

function followupDemoRecords(enterpriseId) {
	const members = [
		{ _id: 'member_demo_101', enterpriseId, cardNo: 'M202601010101', name: '王丽', phone: '13911110101', gender: 2, birthday: '05-20', level: '金卡会员', balance: 50, totalRecharge: 2000, totalConsume: 1950, status: 1, remark: '回访演示-R1', creatorUserId: 'user_demo_0001', createTime: ts(400), updateTime: ts(30) },
		{ _id: 'member_demo_102', enterpriseId, cardNo: 'M202601010102', name: '李强', phone: '13911110102', gender: 1, birthday: '11-03', level: '银卡会员', balance: 0, totalRecharge: 0, totalConsume: 3200, status: 1, remark: '回访演示-R2', creatorUserId: 'user_demo_0001', createTime: ts(500), updateTime: ts(120) },
		{ _id: 'member_demo_103', enterpriseId, cardNo: 'M202601010103', name: '张敏', phone: '13911110103', gender: 2, birthday: '03-15', level: '普通会员', balance: 800, totalRecharge: 1000, totalConsume: 200, status: 1, remark: '回访演示-R3', creatorUserId: 'user_demo_0001', createTime: ts(300), updateTime: ts(300) },
		{ _id: 'member_demo_104', enterpriseId, cardNo: 'M202601010104', name: '赵刚', phone: '13911110104', gender: 1, birthday: '', level: '银卡会员', balance: 0, totalRecharge: 0, totalConsume: 900, status: 1, remark: '回访演示-R7', creatorUserId: 'user_demo_0001', createTime: ts(200), updateTime: ts(60) }
	]
	const cars = [
		{ _id: 'car_demo_101', userId: 'user_demo_0001', enterpriseId, memberId: 'member_demo_101', carNumber: '粤A66666', owner: '王丽', ownerphone: '13911110101', carType: '迈腾', brand: '大众', engineNumber: '', frame: '', insure: ts(-20), other: '' },
		{ _id: 'car_demo_102', userId: 'user_demo_0001', enterpriseId, memberId: 'member_demo_102', carNumber: '粤B22222', owner: '李强', ownerphone: '13911110102', carType: '凯美瑞', brand: '丰田', engineNumber: '', frame: '', insure: null, other: '' },
		{ _id: 'car_demo_103', userId: 'user_demo_0001', enterpriseId, memberId: 'member_demo_103', carNumber: '粤C33333', owner: '张敏', ownerphone: '13911110103', carType: '轩逸', brand: '日产', engineNumber: '', frame: '', insure: null, other: '' },
		{ _id: 'car_demo_104', userId: 'user_demo_0001', enterpriseId, memberId: 'member_demo_104', carNumber: '粤D44444', owner: '赵刚', ownerphone: '13911110104', carType: '朗逸', brand: '大众', engineNumber: '', frame: '', insure: null, other: '' }
	]
	const orders = [
		{ _id: 'order_demo_101', userId: 'user_demo_0001', enterpriseId, carInfoId: 'car_demo_101', memberId: 'member_demo_101', time: ts(30), status: 2, updateTime: ts(30) },
		{ _id: 'order_demo_102', userId: 'user_demo_0001', enterpriseId, carInfoId: 'car_demo_102', memberId: 'member_demo_102', time: ts(120), status: 2, updateTime: ts(120) },
		{ _id: 'order_demo_103', userId: 'user_demo_0001', enterpriseId, carInfoId: 'car_demo_102', memberId: 'member_demo_102', time: ts(200), status: 2, updateTime: ts(200) },
		{ _id: 'order_demo_104', userId: 'user_demo_0001', enterpriseId, carInfoId: 'car_demo_102', memberId: 'member_demo_102', time: ts(300), status: 2, updateTime: ts(300) },
		{ _id: 'order_demo_105', userId: 'user_demo_0001', enterpriseId, carInfoId: 'car_demo_104', memberId: 'member_demo_104', time: ts(120), status: 2, updateTime: ts(120) }
	]
	const memberCards = [
		{ _id: 'mcard_demo_101', enterpriseId, memberId: 'member_demo_104', cardName: '小保养 10 次卡', totalTimes: 10, usedTimes: 9, remainingTimes: 1, amount: 1800, status: 1, expireAt: ts(-300), createdAt: ts(320), updatedAt: ts(120) }
	]
	const memberCardItems = [
		{ _id: 'mitem_demo_101', enterpriseId, cardId: 'mcard_demo_101', memberId: 'member_demo_104', goodsName: '小保养（全合成）', totalTimes: 10, usedTimes: 9, remainingTimes: 1, lastUsedAt: ts(120), expireAt: ts(-300), status: 1, createdAt: ts(320), updatedAt: ts(120) }
	]
	return { members, cars, orders, memberCards, memberCardItems }
}

/** 幂等补齐演示数据，返回是否补过 */
function ensureFollowupDemoData(db) {
	const enterpriseId = 'ent_demo_0001'
	if ((db.member || []).some(m => m._id === 'member_demo_101')) return false
	const demo = followupDemoRecords(enterpriseId)
	db.member = (db.member || []).concat(demo.members)
	db.car_info = (db.car_info || []).concat(demo.cars)
	db.order = (db.order || []).concat(demo.orders)
	db.member_card = (db.member_card || []).concat(demo.memberCards)
	db.member_card_item = (db.member_card_item || []).concat(demo.memberCardItems)
	saveDb(db)
	return true
}

function removeFollowupDemoData(db) {
	const memberIds = ['member_demo_101', 'member_demo_102', 'member_demo_103', 'member_demo_104']
	const carIds = ['car_demo_101', 'car_demo_102', 'car_demo_103', 'car_demo_104']
	db.member = (db.member || []).filter(m => memberIds.indexOf(m._id) === -1)
	db.car_info = (db.car_info || []).filter(c => carIds.indexOf(c._id) === -1)
	db.order = (db.order || []).filter(o => memberIds.indexOf(o.memberId) === -1)
	db.member_card = (db.member_card || []).filter(c => memberIds.indexOf(c.memberId) === -1)
	db.member_card_item = (db.member_card_item || []).filter(i => memberIds.indexOf(i.memberId) === -1)
	const taskIds = (db.followup_task || []).filter(t => memberIds.indexOf(t.memberId) > -1).map(t => t._id)
	db.followup_task = (db.followup_task || []).filter(t => memberIds.indexOf(t.memberId) === -1)
	db.followup_script = (db.followup_script || []).filter(s => taskIds.indexOf(s.taskId) === -1)
	db.followup_log = (db.followup_log || []).filter(l => taskIds.indexOf(l.taskId) === -1)
	saveDb(db)
	return taskIds.length
}

/* ---------------- followup_scan ---------------- */

function followup_scan() {
	const db = loadDb()
	ensureFollowupDemoData(db)
	const enterpriseId = 'ent_demo_0001'
	const enterprise = (db.enterprise || [])[0] || { _id: enterpriseId, name: '示范汽车服务中心' }
	const now = Date.now()

	const members = (db.member || []).filter(m => m.enterpriseId === enterpriseId)
	const cars = (db.car_info || []).filter(c => c.enterpriseId === enterpriseId)
	const orders = (db.order || []).filter(o => o.enterpriseId === enterpriseId)
	const cardItems = (db.member_card_item || []).filter(i => i.enterpriseId === enterpriseId && i.status === 1)
	const existTasks = db.followup_task || []

	const memberMap = {}
	members.forEach(m => { memberMap[m._id] = m })

	const stat = {}
	orders.forEach(o => {
		;['car:' + o.carInfoId, 'member:' + o.memberId].forEach(key => {
			if (!o.carInfoId && key.indexOf('car:') === 0) return
			if (!o.memberId && key.indexOf('member:') === 0) return
			if (!stat[key]) stat[key] = { count: 0, lastTime: 0 }
			if (Number(o.status) === 2) stat[key].count++
			if (Number(o.time) > stat[key].lastTime) stat[key].lastTime = Number(o.time)
		})
	})

	const lastByKey = {}
	const recentByCustomer = {}
	existTasks.forEach(t => {
		const customerKey = t.memberId || ('car:' + t.carId)
		const key = t.ruleCode + '|' + customerKey
		lastByKey[key] = Math.max(lastByKey[key] || 0, Number(t.createdAt) || 0)
		if (Number(t.createdAt) > now - 30 * DAY) {
			recentByCustomer[customerKey] = (recentByCustomer[customerKey] || 0) + 1
		}
	})

	const tasks = []
	function push(rule, ctx, customerKey) {
		const key = rule.code + '|' + customerKey
		const last = lastByKey[key] || 0
		if (last && now - last < rule.cooldownDays * DAY) return false
		if ((recentByCustomer[customerKey] || 0) >= 2) return false
		const fact = buildFact(rule, ctx, enterprise)
		tasks.push(buildTask(enterpriseId, rule, ctx, fact))
		lastByKey[key] = now
		recentByCustomer[customerKey] = (recentByCustomer[customerKey] || 0) + 1
		return true
	}

	// R1 保险到期
	cars.forEach(car => {
		if (!car.insure) return
		const leftDays = Math.floor((Number(car.insure) - now) / DAY)
		if (leftDays < 0 || leftDays > RULES.R1.windowDays) return
		const member = car.memberId ? memberMap[car.memberId] : null
		if (!hasConsent(member)) return
		const s = stat['car:' + car._id] || { count: 0, lastTime: 0 }
		push(RULES.R1, {
			member, car, lastOrderTime: s.lastTime, orderCount: s.count,
			reason: `车险 ${fmtDate(car.insure)} 到期，还有 ${leftDays} 天`
		}, car.memberId || ('car:' + car._id))
	})

	// R2 流失挽回
	members.forEach(member => {
		if (member.status !== 1 || !hasConsent(member)) return
		const s = stat['member:' + member._id] || { count: 0, lastTime: 0 }
		if (!s.lastTime || s.count < RULES.R2.minOrders) return
		const gap = Math.floor((now - s.lastTime) / DAY)
		if (gap <= RULES.R2.gapDays) return
		const car = cars.find(c => c.memberId === member._id) || null
		push(RULES.R2, {
			member, car, lastOrderTime: s.lastTime, orderCount: s.count,
			reason: `${gap} 天没到店了，累计到店 ${s.count} 次`
		}, member._id)
	})

	// R3 余额闲置
	members.forEach(member => {
		if (member.status !== 1 || !hasConsent(member)) return
		const balance = Number(member.balance || 0)
		if (balance < RULES.R3.balance) return
		const s = stat['member:' + member._id] || { count: 0, lastTime: 0 }
		const gap = s.lastTime
			? Math.floor((now - s.lastTime) / DAY)
			: Math.floor((now - Number(member.createTime || now)) / DAY)
		if (gap <= RULES.R3.gapDays) return
		const car = cars.find(c => c.memberId === member._id) || null
		push(RULES.R3, {
			member, car, lastOrderTime: s.lastTime, orderCount: s.count,
			reason: `卡里还有 ${balance} 元，${gap} 天没用过`
		}, member._id)
	})

	// R7 次卡余量
	cardItems.forEach(item => {
		if (!item.memberId) return
		const member = memberMap[item.memberId]
		if (!member || member.status !== 1 || !hasConsent(member)) return
		const remaining = Number(item.remainingTimes || 0)
		if (remaining <= 0 || remaining > RULES.R7.remainMax) return
		if (item.expireAt && Number(item.expireAt) < now) return
		const lastUsed = Number(item.lastUsedAt || 0)
		const gap = lastUsed ? Math.floor((now - lastUsed) / DAY) : 999
		if (gap <= RULES.R7.gapDays) return
		const car = cars.find(c => c.memberId === member._id) || null
		const s = stat['member:' + member._id] || { count: 0, lastTime: 0 }
		push(RULES.R7, {
			member, car, cardItem: item, lastOrderTime: s.lastTime, orderCount: s.count,
			reason: `${item.goodsName} 还剩 ${remaining} 次，${gap === 999 ? '一直没用' : gap + ' 天没用了'}`
		}, member._id)
	})

	tasks.sort((a, b) => b.priority - a.priority)
	db.followup_task = (db.followup_task || []).concat(tasks)
	saveDb(db)

	const byRule = {}
	tasks.forEach(t => { byRule[t.ruleCode] = (byRule[t.ruleCode] || 0) + 1 })
	return ok({ created: tasks.length, enterprises: 1, byRule, mock: true })
}

/* ---------------- followup_list ---------------- */

const STATUS_MAP = {
	open: ['pending', 'generated'],
	sent: ['sent'],
	converted: ['converted'],
	ignored: ['ignored']
}

function followup_list(data) {
	const db = loadDb()
	const enterpriseId = 'ent_demo_0001'
	const statusKey = String((data && data.status) || 'open')
	const page = Math.max(1, parseInt(data && data.page) || 1)
	const pageSize = Math.min(500, Math.max(1, parseInt(data && data.pageSize) || 20))
	const keyword = String((data && data.keyword) || '').trim().toLowerCase()

	let list = (db.followup_task || []).filter(t => t.enterpriseId === enterpriseId)
	if (STATUS_MAP[statusKey]) {
		list = list.filter(t => STATUS_MAP[statusKey].indexOf(t.status) > -1)
	} else if (statusKey !== 'all') {
		list = list.filter(t => t.status === statusKey)
	}
	if (keyword) {
		list = list.filter(t => [t.contactName, t.contactPhone, t.ruleLabel, t.reason].join(' ').toLowerCase().indexOf(keyword) > -1)
	}
	list.sort((a, b) => (b.priority - a.priority) || (b.createdAt - a.createdAt))

	const total = list.length
	const start = (page - 1) * pageSize
	const pageList = list.slice(start, start + pageSize)

	// 挂最新话术
	const scriptMap = {}
	;(db.followup_script || []).forEach(s => {
		if (!scriptMap[s.taskId] || Number(s.createdAt) > Number(scriptMap[s.taskId].createdAt)) {
			scriptMap[s.taskId] = s
		}
	})
	const out = pageList.map(t => Object.assign(clone(t), { script: scriptMap[t._id] ? clone(scriptMap[t._id]) : null }))
	return ok({ list: out, total, page, pageSize })
}

/* ---------------- followup_generate ---------------- */

function templateScript(task, tone) {
	const fact = task.factSnapshot || {}
	const customer = fact.customer || {}
	const history = fact.history || {}
	const store = fact.store || {}
	const name = customer.称呼 || '您好'
	const sign = store.名称 ? `——${store.名称}` : ''
	const tail = '（如需停止接收提醒请回复 TD）'
	let text = ''

	if (task.ruleCode === 'R1') {
		const date = (fact.car && fact.car.保险到期) || ''
		text = `${name}您好，您的车险${date ? '将在 ' + date + ' ' : ''}到期，提前跟您说一声。需要的话我们把几家保险的报价整理给您对比一下，您看方便吗？${sign}`
	} else if (task.ruleCode === 'R7') {
		const card = history.次卡 || {}
		text = `${name}您好，您的${card.项目 || '套餐卡'}还剩${card.剩余次数 || 1}次没用，一直没见您过来，提醒一下别忘了。要不要我先帮您约个时间？${sign}`
	} else if (task.ruleCode === 'R3') {
		text = `${name}您好，您卡里还有${history.储值余额 || 0}元一直没用，怕您忘了提醒一下。这两天有空过来做个保养把它用上？${sign}`
	} else {
		const gap = history.距今天数 || 0
		const last = history.上次到店 ? `上次是 ${history.上次到店} 来的，` : ''
		text = `${name}您好，${last}到现在${gap}天没见您了，车子最近开着还顺吗？有空过来我们帮您做个免费检查。${sign}`
	}

	if (tone === 'short') text = text.replace(/，?需要的话我们把几家保险的报价整理给您对比一下，您看方便吗？/, '有空我帮您看看？')
	return text + tail
}

/** 三道闸：与 followup_generate 云函数一致 */
function checkScript(text, fact) {
	const flags = []
	const plain = String(text || '')
	const factText = JSON.stringify(fact || {})
	const numbers = plain.match(/\d+/g) || []
	const missing = numbers.filter(n => factText.indexOf(n) === -1)
	if (missing.length) flags.push('数字不在事实卡内: ' + missing.join(','))
	const banned = Array.from(new Set(GLOBAL_BANNED.concat(((fact.style || {}).禁用词) || [])))
	banned.forEach(word => {
		if (word && plain.indexOf(word) > -1) flags.push('命中禁用词: ' + word)
	})
	if (plain.length > 180) flags.push('过长: ' + plain.length)
	if (plain.length < 30) flags.push('过短: ' + plain.length)
	return flags
}

/** 调本地 AI 代理；代理不在或失败时返回 { error }，不抛异常 */
function callLocalProxy(fact, tone) {
	return new Promise((resolve) => {
		if (!FOLLOWUP_PROXY_URL) return resolve({ error: 'NO_PROXY' })
		uni.request({
			url: FOLLOWUP_PROXY_URL.replace(/\/$/, '') + '/generate',
			method: 'POST',
			timeout: 30000,
			header: { 'Content-Type': 'application/json' },
			data: { fact, tone },
			success: (res) => {
				const body = res.data || {}
				if (res.statusCode === 200 && body.code === 200 && body.data && body.data.full_text) {
					resolve({ data: body.data })
				} else {
					resolve({ error: body.error || 'PROXY_ERROR', message: body.message || ('HTTP ' + res.statusCode) })
				}
			},
			fail: () => resolve({ error: 'PROXY_OFFLINE' })
		})
	})
}

function followup_generate(data) {
	const db = loadDb()
	const enterpriseId = 'ent_demo_0001'
	const taskId = String((data && data.taskId) || '')
	if (!taskId) return fail('缺少 taskId')
	const tone = String((data && data.tone) || 'warm')
	const regenerate = data && data.regenerate === true

	const task = (db.followup_task || []).find(t => t._id === taskId)
	if (!task) return fail('回访任务不存在')

	// 7 天内复用
	if (!regenerate) {
		const cached = (db.followup_script || [])
			.filter(s => s.taskId === taskId)
			.sort((a, b) => b.createdAt - a.createdAt)[0]
		if (cached && Date.now() - Number(cached.createdAt || 0) < CACHE_DAYS * DAY) {
			return ok({ script: clone(cached), cached: true })
		}
	}

	const fact = task.factSnapshot || {}
	return callLocalProxy(fact, tone).then(result => {
		let fullText = ''
		let meta = { source: 'template', model: '', opening: '', reasonText: '', invite: '', riskFlags: [] }

		if (result.data && result.data.full_text) {
			const flags = checkScript(result.data.full_text, fact)
			if (!flags.length) {
				fullText = result.data.full_text
				meta = {
					source: 'ai',
					model: result.data.model || 'local-proxy',
					opening: result.data.opening || '',
					reasonText: result.data.reason_text || '',
					invite: result.data.invite || '',
					riskFlags: []
				}
			} else {
				meta.riskFlags = flags
			}
		} else if (result.error === 'PROXY_OFFLINE') {
			meta.riskFlags = ['本地 AI 代理未启动（node scripts/local-ai-proxy.js）']
		} else if (result.error === 'NO_KEY') {
			meta.riskFlags = ['代理已启动但未配 DASHSCOPE_API_KEY']
		} else if (result.error && result.error !== 'NO_PROXY') {
			meta.riskFlags = ['代理返回异常: ' + (result.message || result.error)]
		}

		if (!fullText) fullText = templateScript(task, tone)

		const now = Date.now()
		const script = {
			_id: makeId('fscript'),
			enterpriseId,
			taskId,
			fullText,
			opening: meta.opening,
			reasonText: meta.reasonText,
			invite: meta.invite,
			tone,
			source: meta.source,
			model: meta.model,
			promptVersion: 'v1',
			riskFlags: meta.riskFlags,
			createdAt: now
		}
		db.followup_script = (db.followup_script || []).concat([script])
		if (task.status === 'pending') {
			task.status = 'generated'
			task.updatedAt = now
		}
		db.followup_log = (db.followup_log || []).concat([{
			_id: makeId('flog'),
			enterpriseId,
			taskId,
			action: 'generate',
			channel: 'manual',
			operatorUserId: 'user_demo_0001',
			operatorName: '管理员',
			note: meta.source === 'ai' ? 'AI 生成（本地代理）' : '模板生成（' + (meta.riskFlags[0] || '未启用代理') + '）',
			createdAt: now
		}])
		saveDb(db)
		return ok({ script: clone(script), cached: false })
	})
}

/* ---------------- followup_mark ---------------- */

const ACTION_STATUS = { sent: 'sent', ignored: 'ignored', converted: 'converted' }
const ACTION_CHANNEL = { copy: 'manual', wechat: 'manual', call: 'call', sms: 'sms', sent: 'manual', ignored: '', converted: '' }

function followup_mark(data) {
	const db = loadDb()
	const enterpriseId = 'ent_demo_0001'
	const taskId = String((data && data.taskId) || '')
	const action = String((data && data.action) || '')
	if (!taskId) return fail('缺少 taskId')
	if (!ACTION_CHANNEL.hasOwnProperty(action)) return fail('不支持的动作')

	const task = (db.followup_task || []).find(t => t._id === taskId)
	if (!task) return fail('回访任务不存在')

	const now = Date.now()
	db.followup_log = (db.followup_log || []).concat([{
		_id: makeId('flog'),
		enterpriseId,
		taskId,
		action,
		channel: ACTION_CHANNEL[action],
		operatorUserId: 'user_demo_0001',
		operatorName: '管理员',
		note: String((data && data.note) || ''),
		createdAt: now
	}])
	const nextStatus = ACTION_STATUS[action]
	if (nextStatus) {
		task.status = nextStatus
		task.updatedAt = now
	}
	saveDb(db)
	return ok({ taskId, action, status: nextStatus || task.status })
}

/* ---------------- followup_debug（mock 版） ---------------- */

function pingProxy() {
	return new Promise((resolve) => {
		if (!FOLLOWUP_PROXY_URL) return resolve({ online: false, hasKey: false })
		uni.request({
			url: FOLLOWUP_PROXY_URL.replace(/\/$/, '') + '/health',
			method: 'GET',
			timeout: 5000,
			success: (res) => {
				const body = res.data || {}
				resolve({ online: res.statusCode === 200 && !!body.ok, hasKey: !!body.hasKey, model: body.model || '' })
			},
			fail: () => resolve({ online: false, hasKey: false })
		})
	})
}

function followup_debug(data) {
	const action = String((data && data.action) || 'diagnose')
	const db = loadDb()

	if (action === 'seed') {
		const added = ensureFollowupDemoData(db)
		return ok({ seeded: added, note: added ? '已补 4 个演示客户（王丽/李强/张敏/赵刚）' : '演示客户已存在，未重复添加' })
	}
	if (action === 'clear') {
		const removed = removeFollowupDemoData(db)
		return ok({ cleared: true, removedTasks: removed })
	}
	if (action === 'test_model') {
		return pingProxy().then(p => ok({
			mock: true,
			proxy: p,
			note: p.online
				? (p.hasKey ? '代理在线，已配 Key，可生成 AI 话术' : '代理在线但未配 DASHSCOPE_API_KEY，将走模板')
				: '本地代理未启动：node scripts/local-ai-proxy.js'
		}))
	}

	// diagnose
	const enterpriseId = 'ent_demo_0001'
	const members = (db.member || []).filter(m => m.enterpriseId === enterpriseId)
	const cars = (db.car_info || []).filter(c => c.enterpriseId === enterpriseId)
	const orders = (db.order || []).filter(o => o.enterpriseId === enterpriseId)
	const cardItems = (db.member_card_item || []).filter(i => i.enterpriseId === enterpriseId)
	const tasks = db.followup_task || []
	const scripts = db.followup_script || []
	const now = Date.now()

	const memberMap = {}
	members.forEach(m => { memberMap[m._id] = m })
	const stat = {}
	orders.forEach(o => {
		if (o.memberId) {
			const key = 'member:' + o.memberId
			if (!stat[key]) stat[key] = { count: 0, lastTime: 0 }
			if (Number(o.status) === 2) stat[key].count++
			if (Number(o.time) > stat[key].lastTime) stat[key].lastTime = Number(o.time)
		}
	})

	const rules = []
	// R1
	{
		let eligible = 0
		const blocked = {}
		cars.forEach(car => {
			if (!car.insure) { blocked['车辆未填保险到期日'] = (blocked['车辆未填保险到期日'] || 0) + 1; return }
			const left = Math.floor((Number(car.insure) - now) / DAY)
			if (left < 0) blocked['保险已过期'] = (blocked['保险已过期'] || 0) + 1
			else if (left > RULES.R1.windowDays) blocked['保险到期超过 30 天'] = (blocked['保险到期超过 30 天'] || 0) + 1
			else eligible++
		})
		rules.push({ code: 'R1', label: RULES.R1.label, eligible, blocked })
	}
	// R2 / R3
	{
		let r2Eligible = 0, r3Eligible = 0
		const r2Blocked = {}, r3Blocked = {}
		members.forEach(m => {
			if (m.status !== 1) { r2Blocked['会员已停用'] = (r2Blocked['会员已停用'] || 0) + 1; return }
			const s = stat['member:' + m._id] || { count: 0, lastTime: 0 }
			// R2
			if (!s.lastTime) r2Blocked['无订单（或订单未写 memberId）'] = (r2Blocked['无订单（或订单未写 memberId）'] || 0) + 1
			else if (s.count < RULES.R2.minOrders) r2Blocked['入账订单不足 2 笔'] = (r2Blocked['入账订单不足 2 笔'] || 0) + 1
			else if (Math.floor((now - s.lastTime) / DAY) <= RULES.R2.gapDays) r2Blocked['90 天内到过店'] = (r2Blocked['90 天内到过店'] || 0) + 1
			else r2Eligible++
			// R3
			const balance = Number(m.balance || 0)
			if (balance < RULES.R3.balance) r3Blocked['余额不足 200'] = (r3Blocked['余额不足 200'] || 0) + 1
			else {
				const gap = s.lastTime
					? Math.floor((now - s.lastTime) / DAY)
					: Math.floor((now - Number(m.createTime || now)) / DAY)
				if (gap <= RULES.R3.gapDays) r3Blocked['90 天内到过店/开卡'] = (r3Blocked['90 天内到过店/开卡'] || 0) + 1
				else r3Eligible++
			}
		})
		rules.push({ code: 'R2', label: RULES.R2.label, eligible: r2Eligible, blocked: r2Blocked })
		rules.push({ code: 'R3', label: RULES.R3.label, eligible: r3Eligible, blocked: r3Blocked })
	}
	// R7
	{
		let eligible = 0
		const blocked = {}
		cardItems.forEach(item => {
			const remaining = Number(item.remainingTimes || 0)
			if (remaining <= 0) blocked['次数已用完'] = (blocked['次数已用完'] || 0) + 1
			else if (remaining > RULES.R7.remainMax) blocked['剩余次数 > 1'] = (blocked['剩余次数 > 1'] || 0) + 1
			else if (item.expireAt && Number(item.expireAt) < now) blocked['卡已过期'] = (blocked['卡已过期'] || 0) + 1
			else {
				const lastUsed = Number(item.lastUsedAt || 0)
				const gap = lastUsed ? Math.floor((now - lastUsed) / DAY) : 999
				if (gap <= RULES.R7.gapDays) blocked['60 天内核销过'] = (blocked['60 天内核销过'] || 0) + 1
				else eligible++
			}
		})
		if (!cardItems.length) blocked['次卡表为空'] = 1
		rules.push({ code: 'R7', label: RULES.R7.label, eligible, blocked })
	}

	const hints = []
	if (!members.length) hints.push('会员表为空，先开几个会员')
	if (!tasks.length) hints.push('还没有任务，点「刷新名单」触发一次扫描')
	if (!scripts.length) hints.push('还没有话术，点任务上的「生成话术」')

	return pingProxy().then(p => ok({
		mock: true,
		counts: {
			member: members.length,
			car: cars.length,
			order: orders.length,
			memberCardItem: cardItems.length,
			followupTask: tasks.length,
			followupScript: scripts.length
		},
		rules,
		model: { hasKey: p.hasKey, proxyOnline: p.online, model: p.model || '' },
		hints
	}))
}

export {
	followup_scan,
	followup_generate,
	followup_list,
	followup_mark,
	followup_debug,
	// 导出给测试脚本复用
	templateScript,
	checkScript,
	ensureFollowupDemoData
}
