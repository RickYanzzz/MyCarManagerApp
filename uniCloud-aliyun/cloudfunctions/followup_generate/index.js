'use strict'
/**
 * 回访话术生成
 *
 * 原则：规则引擎给事实，模型只负责措辞。
 * - 输入只有 factSnapshot（已脱敏），绝不把原始表、手机号、完整车牌发给模型
 * - 输出必须通过三道闸：数字白名单 / 禁用词 / 长度
 * - 任一不通过 → 自动降级为模板话术（source = 'template'），保证店主永远有话术可用
 *
 * 环境变量：
 *   DASHSCOPE_API_KEY 阿里云百炼（通义千问）密钥，未配置则全部走模板
 *   FOLLOWUP_MODEL    模型名，默认 qwen-plus
 */
const db = uniCloud.database()

const MODEL = process.env.FOLLOWUP_MODEL || 'qwen-plus'
const PROMPT_VERSION = 'v1'
const CACHE_DAYS = 7
const DAY = 86400000

const GLOBAL_BANNED = ['最低', '保证', '绝对', '第一', '包治', '永久', '返现', '全网', '最便宜']

const RULE_LABEL = {
	R1: '保险到期',
	R2: '流失挽回',
	R3: '余额闲置',
	R7: '次卡余量'
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

function systemPrompt() {
	return [
		'你是一家汽修门店的服务顾问，帮店主给老客户写一条微信回访话术。',
		'硬性规则：',
		'1. 只能使用【事实卡】里出现的信息，禁止编造任何权益、折扣、日期、金额、项目、里程。',
		'2. 不承诺价格、不保证效果，不使用「最低/保证/绝对/第一/包治/永久」这类词。',
		'3. 80-110 字，口语化，像店里师傅说话，不要客套话堆砌，不要列条。',
		'4. 称呼用事实卡里的「称呼」，不要加全名。',
		'5. 结尾给一个轻量的行动邀请（来店里 / 打个电话 / 帮你预约），不要逼单。',
		'6. 只输出 JSON，不要 markdown 代码块，不要多余解释：',
		'{"full_text":"","opening":"","reason_text":"","invite":""}'
	].join('\n')
}

function templateScript(task, tone) {
	const fact = task.factSnapshot || {}
	const customer = fact.customer || {}
	const history = fact.history || {}
	const trigger = fact.trigger || {}
	const store = fact.store || {}
	const name = customer.称呼 || '您好'
	const sign = store.名称 ? `——${store.名称}` : ''
	const tail = '（如需停止接收提醒请回复 TD）'
	let text = ''

	if (task.ruleCode === 'R1') {
		const date = (fact.car && fact.car.保险到期) || ''
		text = `${name}您好，您的车险将在 ${date} 到期，提前跟您说一声。需要的话我们把几家保险的报价整理给您对比一下，您看方便吗？${sign}`
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

/** 三道闸：任一命中就算风险 */
function checkScript(text, fact) {
	const flags = []
	const plain = String(text || '')

	// 1. 数字白名单：话术里出现的数字必须能在事实卡里找到
	const factText = JSON.stringify(fact || {})
	const numbers = plain.match(/\d+/g) || []
	const missing = numbers.filter(n => factText.indexOf(n) === -1)
	if (missing.length) flags.push('数字不在事实卡内: ' + missing.join(','))

	// 2. 禁用词
	const banned = Array.from(new Set(GLOBAL_BANNED.concat(((fact.style || {}).禁用词) || [])))
	banned.forEach(word => {
		if (word && plain.indexOf(word) > -1) flags.push('命中禁用词: ' + word)
	})

	// 3. 长度
	if (plain.length > 180) flags.push('过长: ' + plain.length)
	if (plain.length < 30) flags.push('过短: ' + plain.length)

	return flags
}

async function callModel(fact, tone) {
	const apiKey = process.env.DASHSCOPE_API_KEY
	if (!apiKey) return { error: 'NO_KEY' }

	const toneText = tone === 'pro' ? '语气专业、简洁一些' : tone === 'short' ? '尽量短，控制在 60 字左右' : '语气亲切自然'
	const body = {
		model: MODEL,
		temperature: 0.7,
		max_tokens: 400,
		messages: [
			{ role: 'system', content: systemPrompt() },
			{ role: 'user', content: `${toneText}\n【事实卡】\n${JSON.stringify(fact, null, 2)}` }
		]
	}

	const res = await uniCloud.httpclient.request('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: 'Bearer ' + apiKey
		},
		data: body,
		contentType: 'json',
		dataType: 'json',
		timeout: 20000
	})

	const data = res.data || {}
	if (!data.choices || !data.choices.length) {
		return { error: 'MODEL_ERROR', message: JSON.stringify(data).slice(0, 200) }
	}
	const content = String(data.choices[0].message.content || '').trim()
	const jsonText = content.replace(/^```json\s*/i, '').replace(/```$/, '').trim()
	let parsed = null
	try {
		parsed = JSON.parse(jsonText)
	} catch (e) {
		// 模型偶尔不按 JSON 输出，整段当正文
		parsed = { full_text: content }
	}
	return { data: parsed }
}

exports.main = async (event, context) => {
	const auth = await getOperator(event)
	if (auth.error) return auth.error

	const taskId = String(event.taskId || '')
	if (!taskId) return fail(400, '缺少 taskId')
	const tone = String(event.tone || 'warm')
	const regenerate = event.regenerate === true

	const taskRes = await db.collection('followup_task').doc(taskId).get()
	const task = (taskRes.data || [])[0]
	if (!task) return fail(404, '回访任务不存在')
	if (task.enterpriseId !== auth.enterpriseId) return fail(403, '无权访问该任务')

	// 7 天内复用，避免重复调模型
	if (!regenerate) {
		const cacheRes = await db.collection('followup_script')
			.where({ taskId, enterpriseId: auth.enterpriseId })
			.orderBy('createdAt', 'desc')
			.limit(1)
			.get()
		const cached = (cacheRes.data || [])[0]
		if (cached && Date.now() - Number(cached.createdAt || 0) < CACHE_DAYS * DAY) {
			return { code: 200, status: 'success', data: { script: cached, cached: true } }
		}
	}

	const fact = task.factSnapshot || {}
	let fullText = ''
	let meta = { source: 'template', model: '', opening: '', reasonText: '', invite: '', riskFlags: [] }

	try {
		const result = await callModel(fact, tone)
		if (result.data && result.data.full_text) {
			const flags = checkScript(result.data.full_text, fact)
			if (!flags.length) {
				fullText = result.data.full_text
				meta = {
					source: 'ai',
					model: MODEL,
					opening: result.data.opening || '',
					reasonText: result.data.reason_text || '',
					invite: result.data.invite || '',
					riskFlags: []
				}
			} else {
				meta.riskFlags = flags
			}
		} else if (result.message) {
			meta.riskFlags = ['模型返回异常: ' + result.message]
		}
	} catch (err) {
		meta.riskFlags = ['模型调用失败: ' + ((err && err.message) || 'unknown')]
	}

	// 降级：模板兜底
	if (!fullText) fullText = templateScript(task, tone)

	const script = {
		enterpriseId: auth.enterpriseId,
		taskId,
		fullText,
		opening: meta.opening,
		reasonText: meta.reasonText,
		invite: meta.invite,
		tone,
		source: meta.source,
		model: meta.model,
		promptVersion: PROMPT_VERSION,
		riskFlags: meta.riskFlags,
		createdAt: Date.now()
	}
	const addRes = await db.collection('followup_script').add(script)
	script._id = addRes.id

	if (task.status === 'pending') {
		await db.collection('followup_task').doc(taskId).update({
			status: 'generated',
			updatedAt: Date.now()
		})
	}

	await db.collection('followup_log').add({
		enterpriseId: auth.enterpriseId,
		taskId,
		action: 'generate',
		channel: 'manual',
		operatorUserId: auth.user._id,
		operatorName: auth.user.name || '',
		note: meta.source === 'ai' ? 'AI 生成' : '模板生成（' + (meta.riskFlags[0] || '未配置模型') + '）',
		createdAt: Date.now()
	})

	return { code: 200, status: 'success', data: { script, cached: false } }
}
