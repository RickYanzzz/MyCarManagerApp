/**
 * mock 回访链路端到端测试（不依赖 HBuilderX / uniCloud）
 *
 * 运行：node scripts/test-mock-followup.mjs
 *
 * 验证内容：
 *   1. followup_scan    演示数据 4 条规则各命中 1 条，称呼正确（王姐/李哥/张姐/赵哥）
 *   2. 冷却去重          紧接着第二次扫描 created = 0
 *   3. followup_list    open 列表 4 条、按优先级排序
 *   4. followup_generate 自动探测代理：在线且配了 Key -> source=ai；否则 -> 模板降级
 *   5. 防幻觉闸          编造数字/禁用词的话术被 checkScript 拦截
 *   6. followup_mark    sent / ignored 状态流转
 */

// ----  stub uni（localStorage 用内存 Map 模拟） ----
const storage = new Map()
globalThis.uni = {
	getStorageSync: (k) => storage.get(k),
	setStorageSync: (k, v) => storage.set(k, v),
	removeStorageSync: (k) => storage.delete(k),
	request: ({ url, method, timeout, header, data, success, fail }) => {
		fetch(url, {
			method: method || 'GET',
			headers: header,
			body: data ? JSON.stringify(data) : undefined,
			signal: AbortSignal.timeout(timeout || 30000)
		}).then(async (res) => {
			const body = await res.json().catch(() => ({}))
			success({ statusCode: res.status, data: body })
		}).catch(fail)
	}
}

const { default: mockApi } = await import('../common/mock/api.js')
const { templateScript, checkScript } = await import('../common/mock/followup.js')
const { FOLLOWUP_PROXY_URL } = await import('../common/mock/config.js')

// 探测代理状态：在线且配 Key 才期待 AI 话术
let proxyState = { online: false, hasKey: false }
try {
	const res = await fetch(FOLLOWUP_PROXY_URL + '/health', { signal: AbortSignal.timeout(3000) })
	const body = await res.json()
	proxyState = { online: !!body.ok, hasKey: !!body.hasKey, model: body.model }
} catch (e) { /* 代理没起 */ }
console.log(`[test] 代理 ${FOLLOWUP_PROXY_URL}：${proxyState.online ? (proxyState.hasKey ? '在线·已配Key' : '在线·未配Key') : '未启动'}`)

let failed = 0
function assert(cond, name, extra) {
	if (cond) {
		console.log('  ✓', name)
	} else {
		failed++
		console.error('  ✗', name, extra === undefined ? '' : '-> ' + JSON.stringify(extra))
	}
}

console.log('== 1. followup_scan：演示数据应命中 4 条规则 ==')
const scanRes = await mockApi.followup_scan({})
assert(scanRes.data.created === 4, 'created = 4', scanRes.data)
assert(scanRes.data.byRule.R1 === 1 && scanRes.data.byRule.R2 === 1 &&
	scanRes.data.byRule.R3 === 1 && scanRes.data.byRule.R7 === 1, 'R1/R2/R3/R7 各 1 条', scanRes.data.byRule)

console.log('== 2. 冷却去重：立刻重扫应为 0 ==')
const scan2 = await mockApi.followup_scan({})
assert(scan2.data.created === 0, '第二次扫描 created = 0', scan2.data)

console.log('== 3. followup_list：open 4 条、优先级降序 ==')
const listRes = await mockApi.followup_list({ status: 'all', page: 1, pageSize: 50 })
const tasks = listRes.data.list
assert(tasks.length === 4, '共 4 条任务', tasks.length)
const byRule = {}
tasks.forEach(t => { byRule[t.ruleCode] = t })
const salutations = { R1: '王姐', R2: '李哥', R3: '张姐', R7: '赵哥' }
Object.keys(salutations).forEach(code => {
	assert(byRule[code] && byRule[code].contactName === salutations[code],
		`${code} 称呼 = ${salutations[code]}`, byRule[code] && byRule[code].contactName)
})
const priorities = tasks.map(t => t.priority)
assert(priorities.every((p, i) => i === 0 || priorities[i - 1] >= p), '按优先级降序', priorities)

const expectAi = proxyState.online && proxyState.hasKey
console.log('== 4. followup_generate：' + (expectAi ? '代理在线已配Key -> 期待 AI 话术' : '无代理/未配Key -> 模板降级') + ' ==')
for (const code of ['R1', 'R2', 'R3', 'R7']) {
	const res = await mockApi.followup_generate({ taskId: byRule[code]._id, tone: 'warm' })
	const s = res.data.script
	const flags = checkScript(s.fullText, byRule[code].factSnapshot)
	assert(flags.length === 0, `${code} 话术通过三道闸`, flags)
	console.log(`     [${code}][${s.source}] ${s.fullText}`)
	assert(s.taskId === byRule[code]._id, `${code} script 归属正确`)
	if (expectAi) {
		assert(s.source === 'ai', `${code} 代理在线时应为 AI 生成`, { source: s.source, risk: s.riskFlags })
	} else {
		assert(s.source === 'template', `${code} 无可用代理时降级模板`, s.source)
	}
}
const task1 = byRule.R1
const gen2 = await mockApi.followup_generate({ taskId: task1._id, tone: 'warm' })
assert(gen2.data.cached === true, '7 天缓存命中（cached=true）')
assert(tasks.find(t => t._id === task1._id) && true, '任务仍存在')

console.log('== 5. 防幻觉闸：编造内容必须被拦 ==')
const fact = byRule.R3.factSnapshot
const bad = checkScript('张姐您好，现推出 399 元保养套餐，全市最低价，保证有效果！', fact)
assert(bad.some(f => f.indexOf('数字不在事实卡内') > -1), '拦截编造数字', bad)
assert(bad.some(f => f.indexOf('最低') > -1), '拦截禁用词「最低」', bad)
assert(bad.some(f => f.indexOf('保证') > -1), '拦截禁用词「保证」', bad)
const good = checkScript(templateScript(byRule.R3, 'warm'), fact)
assert(good.length === 0, '模板话术不触闸', good)

console.log('== 6. followup_mark：状态流转 ==')
const markRes = await mockApi.followup_mark({ taskId: byRule.R2._id, action: 'sent' })
assert(markRes.data.status === 'sent', 'R2 标记已发送', markRes.data)
const markRes2 = await mockApi.followup_mark({ taskId: byRule.R7._id, action: 'ignored' })
assert(markRes2.data.status === 'ignored', 'R7 标记忽略', markRes2.data)
const openList = await mockApi.followup_list({ status: 'open', page: 1, pageSize: 50 })
assert(openList.data.total === 2, 'open 剩 2 条', openList.data.total)
const markBad = await mockApi.followup_mark({ taskId: byRule.R1._id, action: 'hack' }).then(
	() => ({ failed: false }),
	() => ({ failed: true })
)
assert(markBad.failed === true, '非法 action 被拒绝')

console.log('== 7. followup_debug：diagnose / clear ==')
const diag = await mockApi.followup_debug({ action: 'diagnose' })
assert(diag.data.counts.member >= 4, 'diagnose 会员数 >= 4', diag.data.counts)
assert(Array.isArray(diag.data.rules) && diag.data.rules.length === 4, 'diagnose 返回 4 条规则')
const clearRes = await mockApi.followup_debug({ action: 'clear' })
assert(clearRes.data.cleared === true, 'clear 执行成功')
const afterClear = await mockApi.followup_list({ status: 'all', page: 1, pageSize: 50 })
assert(afterClear.data.list.length === 0, 'clear 后任务清空', afterClear.data.list.length)
const reseed = await mockApi.followup_debug({ action: 'seed' })
assert(reseed.data.seeded === true, 'clear 后可重新 seed')
const reseed2 = await mockApi.followup_debug({ action: 'seed' })
assert(reseed2.data.seeded === false, '重复 seed 幂等')

console.log(failed === 0 ? '\n全部通过 ✅' : `\n有 ${failed} 项失败 ❌`)
process.exit(failed === 0 ? 0 : 1)
