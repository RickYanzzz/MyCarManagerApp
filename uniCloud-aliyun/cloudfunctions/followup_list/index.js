'use strict'
/**
 * 回访列表（工作台）
 * 入参：status（open/pending/generated/sent/converted/ignored/all）、page、pageSize、keyword
 * 出参：tasks 带最新一条话术
 */
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

const STATUS_MAP = {
	open: ['pending', 'generated'],
	sent: ['sent'],
	converted: ['converted'],
	ignored: ['ignored']
}

exports.main = async (event, context) => {
	const auth = await getOperator(event)
	if (auth.error) return auth.error

	const statusKey = String(event.status || 'open')
	const page = Math.max(1, parseInt(event.page) || 1)
	const pageSize = Math.min(50, Math.max(1, parseInt(event.pageSize) || 20))
	const keyword = String(event.keyword || '').trim()

	const where = { enterpriseId: auth.enterpriseId }
	if (STATUS_MAP[statusKey]) {
		where.status = dbCmd.in(STATUS_MAP[statusKey])
	} else if (statusKey !== 'all') {
		where.status = statusKey
	}

	const res = await db.collection('followup_task')
		.where(where)
		.orderBy('priority', 'desc')
		.orderBy('createdAt', 'desc')
		.limit(200)
		.get()

	let list = res.data || []
	if (keyword) {
		const kw = keyword.toLowerCase()
		list = list.filter(t => {
			const text = [t.contactName, t.contactPhone, t.ruleLabel, t.reason].join(' ').toLowerCase()
			return text.indexOf(kw) > -1
		})
	}

	const total = list.length
	const start = (page - 1) * pageSize
	const pageList = list.slice(start, start + pageSize)

	// 批量取最新话术
	const ids = pageList.map(t => t._id)
	let scripts = []
	if (ids.length) {
		const sRes = await db.collection('followup_script')
			.where({ enterpriseId: auth.enterpriseId, taskId: dbCmd.in(ids) })
			.orderBy('createdAt', 'desc')
			.limit(200)
			.get()
		scripts = sRes.data || []
	}
	const scriptMap = {}
	scripts.forEach(s => {
		if (!scriptMap[s.taskId]) scriptMap[s.taskId] = s
	})

	const data = pageList.map(t => Object.assign({}, t, {
		script: scriptMap[t._id] || null
	}))

	return {
		code: 200,
		status: 'success',
		data: { list: data, total, page, pageSize }
	}
}
