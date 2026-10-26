'use strict';

/**
 * 车牌识别（百度 OCR）云函数代理
 * --------------------------------------------------------------------------
 * 为什么放到云函数里：
 *   1. 安全：百度 AK/SK 属敏感凭证，放前端会被反编译拿到；放服务端只暴露本云函数
 *   2. 跨端：小程序端直连 aip.baidubce.com 需把它加进 request 合法域名白名单，
 *          而 uniCloud.callFunction 走的是微信内置云调用通道，无需配置域名
 *
 * 入参：{ image: '<纯 base64，不带 data:image/xxx;base64, 前缀>' }
 * 出参：成功 { code: 200, data: { number, color } }
 *       失败 { code: -1, msg: '...' }
 *
 * 注意：阿里云 callFunction 的 event 上限为 2MB，前端已对图片做「最长边压缩 + 体积校验」
 * --------------------------------------------------------------------------
 */

// 优先读云函数环境变量（可在 uniCloud 控制台配置），未配置时回退到内置值
const API_KEY = process.env.BAIDU_OCR_API_KEY || 'MhVAan70TGxg6eK39b8yl36i'
const SECRET_KEY = process.env.BAIDU_OCR_SECRET_KEY || '3wtGLvX3zwqhHxXALeAQf2TzNjDQnMMy'

const TOKEN_URL = 'https://aip.baidubce.com/oauth/2.0/token'
const PLATE_URL = 'https://aip.baidubce.com/rest/2.0/ocr/v1/license_plate'

// uniCloud.httpclient 默认即 application/x-www-form-urlencoded，
// 这里显式声明，避免被误改成 application/json
const FORM_HEADER = {
	'Content-Type': 'application/x-www-form-urlencoded'
}

const MAX_BASE64_LEN = 4 * 1024 * 1024 // 百度要求 base64 不超过 4M

// 百度错误码 → 用户可读提示（未命中时回退到百度原文 error_msg）
const ERROR_MSG_MAP = {
	17: '今日识别额度已用完，请稍后重试或手动输入',
	18: '今日识别额度已用完，请稍后重试或手动输入',
	100: '图片格式不正确，请重新拍摄',
	216101: '图片数据缺失，请重新拍摄',
	282810: '图片无法识别，请重新拍摄',
	282000: '识别服务内部错误，请稍后重试'
}

// 模块级缓存：同一云函数实例存活期间复用 token（百度 token 默认有效期 30 天）
let tokenCache = { value: '', expireAt: 0 }

// 去掉 "data:image/jpeg;base64," 编码头（百度要求传纯 base64）
function stripBase64Header(str) {
	if (!str) return ''
	const idx = str.indexOf(',')
	return idx >= 0 ? str.substring(idx + 1) : str
}

function toQuery(obj) {
	return Object.keys(obj)
		.map(k => encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]))
		.join('&')
}

// 统一把响应体规整成对象（dataType:'json' 解析失败时会拿到字符串）
function normalizeBody(data) {
	if (!data) return {}
	if (typeof data === 'string') {
		try {
			return JSON.parse(data)
		} catch (e) {
			return { raw: data }
		}
	}
	return data
}

async function fetchToken() {
	const res = await uniCloud.httpclient.request(TOKEN_URL, {
		method: 'POST',
		content: toQuery({
			grant_type: 'client_credentials',
			client_id: API_KEY,
			client_secret: SECRET_KEY
		}),
		headers: FORM_HEADER,
		dataType: 'json',
		timeout: 10000
	})
	const body = normalizeBody(res && res.data)
	if (!body.access_token) {
		throw new Error('获取百度token失败：' + JSON.stringify(body))
	}
	return {
		token: body.access_token,
		expiresIn: Number(body.expires_in) || 2592000
	}
}

async function getToken(forceRefresh) {
	const now = Date.now()
	if (!forceRefresh && tokenCache.value && now < tokenCache.expireAt) {
		return tokenCache.value
	}
	const { token, expiresIn } = await fetchToken()
	// 提前 10 分钟过期，规避边界失效
	tokenCache = {
		value: token,
		expireAt: now + Math.max(expiresIn - 600, 60) * 1000
	}
	return token
}

async function callPlateOcr(token, image) {
	const res = await uniCloud.httpclient.request(PLATE_URL + '?access_token=' + token, {
		method: 'POST',
		content: 'image=' + encodeURIComponent(image),
		headers: FORM_HEADER,
		dataType: 'json',
		timeout: 15000
	})
	return normalizeBody(res && res.data)
}

exports.main = async (event) => {
	const image = stripBase64Header(event && event.image)

	if (!image) {
		return { code: -1, msg: '缺少图片数据' }
	}
	if (image.length > MAX_BASE64_LEN) {
		return { code: -1, msg: '图片过大，请重新拍摄' }
	}

	try {
		let token = await getToken(false)
		let body = await callPlateOcr(token, image)

		// 110：token 非法；111：token 过期 —— 强制刷新后重试一次
		if (body.error_code === 110 || body.error_code === 111) {
			token = await getToken(true)
			body = await callPlateOcr(token, image)
		}

		if (body.error_code) {
			console.error('百度车牌识别返回错误：', body)
			return {
				code: -1,
				msg: ERROR_MSG_MAP[body.error_code] || body.error_msg || '识别失败',
				error_code: body.error_code
			}
		}

		const words = body.words_result
		if (!words || !words.number) {
			console.warn('未识别到车牌：', JSON.stringify(body))
			return { code: -1, msg: '未识别到车牌，请重拍或手动输入' }
		}

		return {
			code: 200,
			msg: 'ok',
			data: {
				number: words.number,
				color: words.color || ''
			}
		}
	} catch (e) {
		console.error('ocr_license_plate 执行异常：', e)
		return {
			code: -1,
			msg: '识别服务异常：' + (e && e.message ? e.message : e)
		}
	}
}
