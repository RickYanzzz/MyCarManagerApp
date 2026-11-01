'use strict'
/**
 * 回访扫描：算出"今天该回访谁、为什么"，写入 followup_task
 *
 * 触发方式：
 *   1. 定时触发（每天 08:00，见 package.json triggers），遍历所有企业
 *   2. 前端手动触发，只扫当前店主的门店
 *
 * P0 规则：
 *   R1 保险到期    car_info.insure 在未来 30 天内
 *   R2 流失挽回    最近一次到店距今 > 90 天，且历史入账订单 >= 2
 *   R3 余额闲置    储值余额 >= 200 且 90 天没有到店
 *   R7 次卡余量    member_card_item 剩余 <= 1 次，且 60 天未核销
 *
 * 去重与限频：同规则在冷却期内不重复；同一客户 30 天内最多 2 条任务。
 */
const db = uniCloud.database()

const DAY = 86400000

const RULES = {
	R1: { code: 'R1', label: '保险到期', priority: 90, windowDays: 30, cooldownDays: 180 },
	R2: { code: 'R2', label: '流失挽回', priority: 60, gapDays: 90, minOrders: 2, cooldownDays: 90 },
	R3: { code: 'R3', label: '余额闲置', priority: 55, balance: 200, gapDays: 90, cooldownDays: 60 },
	R7: { code: 'R7', label: '次卡余量', priority: 85, remainMax: 1, gapDays: 60, cooldownDays: 45 }
}

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

// 云函数单次 get 有条数上限，分页取全量
async function fetchAll(collection, where, field, pageSize = 500) {
	const out = []
	let skip = 0
	for (let i = 0; i < 60; i++) {
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

// 客户价值加权：历史消费越高，优先级越高
function valueBonus(totalConsume) {
	const amount = Number(totalConsume || 0)
	if (amount >= 5000) return 10
	if (amount >= 2000) return 5
	return 0
}

/**
 * 事实卡：生成话术的唯一事实来源。
 * 只放脱敏后的信息，手机号、完整车牌都不进来。
 */
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
		trigger: {
			规则: rule.code,
			原因: reason,
			可提权益: ''
		},
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

async function scanEnterprise(enterprise, tasks) {
	const enterpriseId = enterprise._id
	const now = Date.now()

	const [members, cars, orders, cardItems, existTasks] = await Promise.all([
		fetchAll('member', { enterpriseId }, {
			name: true, phone: true, level: true, balance: true, status: true,
			gender: true, totalConsume: true, createTime: true, consentMarketing: true
		}),
		fetchAll('car_info', { enterpriseId }, {
			carNumber: true, owner: true, ownerphone: true, memberId: true,
			brand: true, carType: true, insure: true
		}),
		fetchAll('order', { enterpriseId }, { carInfoId: true, memberId: true, time: true, status: true }),
		fetchAll('member_card_item', { enterpriseId, status: 1 }, {
			cardId: true, memberId: true, goodsName: true, remainingTimes: true, lastUsedAt: true, expireAt: true
		}),
		fetchAll('followup_task', { enterpriseId }, { ruleCode: true, memberId: true, carId: true, createdAt: true })
	])

	const memberMap = {}
	members.forEach(m => { memberMap[m._id] = m })
	const carMap = {}
	cars.forEach(c => { carMap[c._id] = c })

	// 按客户 / 车辆统计到店情况
	const stat = {}
	function bump(key, order) {
		if (!stat[key]) stat[key] = { count: 0, lastTime: 0 }
		const s = stat[key]
		if (Number(order.status) === 2) s.count++
		if (Number(order.time) > s.lastTime) s.lastTime = Number(order.time)
	}
	orders.forEach(o => {
		if (o.carInfoId) bump('car:' + o.carInfoId, o)
		if (o.memberId) bump('member:' + o.memberId, o)
	})

	// 去重 / 限频
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

	function hasConsent(member) {
		// 只登记了车辆、还没开卡的客户，按门店自有客户处理
		if (!member) return true
		return member.consentMarketing !== false
	}

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
	for (let i = 0; i < cars.length; i++) {
		const car = cars[i]
		if (!car.insure) continue
		const leftDays = Math.floor((Number(car.insure) - now) / DAY)
		if (leftDays < 0 || leftDays > RULES.R1.windowDays) continue
		const member = car.memberId ? memberMap[car.memberId] : null
		if (!hasConsent(member)) continue
		const s = stat['car:' + car._id] || { count: 0, lastTime: 0 }
		push(RULES.R1, {
			member,
			car,
			lastOrderTime: s.lastTime,
			orderCount: s.count,
			reason: `车险 ${fmtDate(car.insure)} 到期，还有 ${leftDays} 天`
		}, car.memberId || ('car:' + car._id))
	}

	// R2 流失挽回
	for (let i = 0; i < members.length; i++) {
		const member = members[i]
		if (member.status !== 1 || !hasConsent(member)) continue
		const s = stat['member:' + member._id] || { count: 0, lastTime: 0 }
		if (!s.lastTime || s.count < RULES.R2.minOrders) continue
		const gap = Math.floor((now - s.lastTime) / DAY)
		if (gap <= RULES.R2.gapDays) continue
		const car = cars.find(c => c.memberId === member._id) || null
		push(RULES.R2, {
			member,
			car,
			lastOrderTime: s.lastTime,
			orderCount: s.count,
			reason: `${gap} 天没到店了，累计到店 ${s.count} 次`
		}, member._id)
	}

	// R3 余额闲置
	for (let i = 0; i < members.length; i++) {
		const member = members[i]
		if (member.status !== 1 || !hasConsent(member)) continue
		const balance = Number(member.balance || 0)
		if (balance < RULES.R3.balance) continue
		const s = stat['member:' + member._id] || { count: 0, lastTime: 0 }
		const gap = s.lastTime
			? Math.floor((now - s.lastTime) / DAY)
			: Math.floor((now - Number(member.createTime || now)) / DAY)
		if (gap <= RULES.R3.gapDays) continue
		const car = cars.find(c => c.memberId === member._id) || null
		push(RULES.R3, {
			member,
			car,
			lastOrderTime: s.lastTime,
			orderCount: s.count,
			reason: `卡里还有 ${balance} 元，${gap} 天没用过`
		}, member._id)
	}

	// R7 次卡余量
	for (let i = 0; i < cardItems.length; i++) {
		const item = cardItems[i]
		if (!item.memberId) continue
		const member = memberMap[item.memberId]
		if (!member || member.status !== 1 || !hasConsent(member)) continue
		const remaining = Number(item.remainingTimes || 0)
		if (remaining <= 0 || remaining > RULES.R7.remainMax) continue
		if (item.expireAt && Number(item.expireAt) < now) continue
		const lastUsed = Number(item.lastUsedAt || 0)
		const gap = lastUsed ? Math.floor((now - lastUsed) / DAY) : 999
		if (gap <= RULES.R7.gapDays) continue
		const car = cars.find(c => c.memberId === member._id) || null
		const s = stat['member:' + member._id] || { count: 0, lastTime: 0 }
		push(RULES.R7, {
			member,
			car,
			cardItem: item,
			lastOrderTime: s.lastTime,
			orderCount: s.count,
			reason: `${item.goodsName} 还剩 ${remaining} 次，${gap === 999 ? '一直没用' : gap + ' 天没用了'}`
		}, member._id)
	}
}

exports.main = async (event, context) => {
	const source = event || {}
	const byTimer = source.Type === 'timer' || !!source.triggerName || source.type === 'timer'

	let enterprises = []
	if (byTimer) {
		enterprises = await fetchAll('enterprise', {}, { name: true, phone: true, address: true })
	} else {
		const auth = await getOperator(source)
		if (auth.error) return auth.error
		const res = await db.collection('enterprise').doc(auth.enterpriseId).get()
		const one = (res.data || [])[0]
		if (!one) return fail(404, '门店不存在')
		enterprises = [one]
	}
	if (!enterprises.length) {
		return { code: 200, status: 'success', data: { created: 0, enterprises: 0, byRule: {} } }
	}

	const tasks = []
	for (let i = 0; i < enterprises.length; i++) {
		await scanEnterprise(enterprises[i], tasks)
	}

	tasks.sort((a, b) => b.priority - a.priority)
	let created = 0
	for (let i = 0; i < tasks.length; i++) {
		await db.collection('followup_task').add(tasks[i])
		created++
	}

	const byRule = {}
	tasks.forEach(t => { byRule[t.ruleCode] = (byRule[t.ruleCode] || 0) + 1 })

	return {
		code: 200,
		status: 'success',
		data: { created, enterprises: enterprises.length, byRule }
	}
}
