#!/usr/bin/env node
/**
 * 本地 AI 代理 —— 给 mock 环境的 followup_generate 提供真实大模型能力。
 *
 * 为什么需要它：
 *   USE_MOCK = true 时 App 不连 uniCloud，云函数 followup_generate 不会执行。
 *   这个代理在本机起一个 HTTP 服务，复刻云函数里"调通义千问"的那一段，
 *   mock 的 followup_generate 会把事实卡 POST 过来，拿回 AI 话术。
 *   没启动 / 没配 Key 都没关系，mock 会自动降级为模板话术。
 *
 * 用法（Windows Git Bash）：
 *   DASHSCOPE_API_KEY=sk-xxx node scripts/local-ai-proxy.js
 * 或把 Key 写进 scripts/local-ai-proxy.key（一行，已 gitignore），然后：
 *   node scripts/local-ai-proxy.js
 *
 * 环境变量：
 *   DASHSCOPE_API_KEY   阿里云百炼 Key（也可放 local-ai-proxy.key 文件）
 *   FOLLOWUP_MODEL      模型名，默认 qwen-plus
 *   FOLLOWUP_PROXY_PORT 端口，默认 8787
 *
 * 端点：
 *   GET  /health   -> { ok, model, hasKey }
 *   POST /generate -> 入参 { fact, tone }，出参 { code, data: { full_text, opening, reason_text, invite, model } }
 *
 * 安全：只监听 127.0.0.1，Key 不出本机；fact 已在 mock 侧脱敏（无手机号/全车牌）。
 */
'use strict'

const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = Number(process.env.FOLLOWUP_PROXY_PORT || 8787)
const HOST = '127.0.0.1'
const MODEL = process.env.FOLLOWUP_MODEL || 'qwen-plus'
const KEY_FILE = path.join(__dirname, 'local-ai-proxy.key')
const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'

function loadApiKey() {
	if (process.env.DASHSCOPE_API_KEY) return process.env.DASHSCOPE_API_KEY.trim()
	try {
		return fs.readFileSync(KEY_FILE, 'utf8').trim()
	} catch (e) {
		return ''
	}
}

/** 与 uniCloud followup_generate 完全一致的 system prompt，改了一边记得改另一边 */
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

async function callDashScope(apiKey, fact, tone) {
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
	const res = await fetch(DASHSCOPE_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: 'Bearer ' + apiKey
		},
		body: JSON.stringify(body)
	})
	const data = await res.json().catch(() => ({}))
	if (!res.ok) {
		const msg = (data && data.error && data.error.message) || ('HTTP ' + res.status)
		throw new Error(msg)
	}
	if (!data.choices || !data.choices.length) {
		throw new Error('模型返回为空: ' + JSON.stringify(data).slice(0, 200))
	}
	const content = String(data.choices[0].message.content || '').trim()
	const jsonText = content.replace(/^```json\s*/i, '').replace(/```$/, '').trim()
	try {
		return JSON.parse(jsonText)
	} catch (e) {
		return { full_text: content }
	}
}

function send(res, status, obj) {
	const text = JSON.stringify(obj)
	res.writeHead(status, {
		'Content-Type': 'application/json; charset=utf-8',
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type'
	})
	res.end(text)
}

function readBody(req) {
	return new Promise((resolve, reject) => {
		let raw = ''
		req.on('data', chunk => {
			raw += chunk
			if (raw.length > 1024 * 1024) reject(new Error('body too large'))
		})
		req.on('end', () => {
			try {
				resolve(raw ? JSON.parse(raw) : {})
			} catch (e) {
				reject(new Error('invalid json'))
			}
		})
		req.on('error', reject)
	})
}

const server = http.createServer(async (req, res) => {
	if (req.method === 'OPTIONS') return send(res, 204, {})

	const apiKey = loadApiKey()

	if (req.method === 'GET' && req.url === '/health') {
		return send(res, 200, { ok: true, model: MODEL, hasKey: !!apiKey })
	}

	if (req.method === 'POST' && req.url === '/generate') {
		let body
		try {
			body = await readBody(req)
		} catch (e) {
			return send(res, 400, { code: 400, error: 'BAD_REQUEST', message: e.message })
		}
		if (!apiKey) {
			return send(res, 200, { code: 200, error: 'NO_KEY', message: '未配置 DASHSCOPE_API_KEY，mock 将走模板话术' })
		}
		const fact = body.fact || {}
		const tone = String(body.tone || 'warm')
		const t0 = Date.now()
		try {
			const parsed = await callDashScope(apiKey, fact, tone)
			console.log(`[generate] ${(fact.customer && fact.customer.称呼) || '?'} ${(fact.trigger && fact.trigger.规则) || ''} -> ${(parsed.full_text || '').length} 字，${Date.now() - t0}ms`)
			return send(res, 200, {
				code: 200,
				data: {
					full_text: parsed.full_text || '',
					opening: parsed.opening || '',
					reason_text: parsed.reason_text || '',
					invite: parsed.invite || '',
					model: MODEL
				}
			})
		} catch (e) {
			console.error('[generate] 模型调用失败:', e.message)
			return send(res, 200, { code: 200, error: 'MODEL_ERROR', message: e.message })
		}
	}

	send(res, 404, { code: 404, error: 'NOT_FOUND' })
})

server.listen(PORT, HOST, () => {
	const hasKey = !!loadApiKey()
	console.log(`本地 AI 代理已启动: http://${HOST}:${PORT}`)
	console.log(`  模型: ${MODEL}`)
	console.log(`  Key : ${hasKey ? '已配置' : '未配置（mock 侧会走模板话术）'}`)
	console.log('  按 Ctrl+C 停止')
})
