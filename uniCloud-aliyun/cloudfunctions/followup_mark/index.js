'use strict'
/**
 * 回访动作记录
 * action：
 *   copy    复制话术（不改任务状态）
 *   wechat  跳转微信（不改任务状态）
 *   call    打电话
 *   sms     短信
 *   sent    已发送 → 任务状态置 sent
 *   ignored 忽略   → 任务状态置 ignored
 *   converted 已到店 → 任务状态置 converted
 */
const db = uniCloud.database()

const ACTION_STATUS = {
	sent: 'sent',
	ignored: 'ignored',
	converted: 'converted'
}

const ACTION_CHANNEL = {
	copy: 'manual',
	wechat: 'manual',
	call: 'call',
	sms: 'sms',
	sent: 'manual',
	ignored: '',
	converted: ''
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

exports.main = async (event, context) => {
	const auth = await getOperator(event)
	if (auth.error) return auth.error

	const taskId = String(event.taskId || '')
	const action = String(event.action || '')
	if (!taskId) return fail(400, '缺少 taskId')
	if (!ACTION_CHANNEL.hasOwnProperty(action)) return fail(400, '不支持的动作')

	const taskRes = await db.collection('followup_task').doc(taskId).get()
	const task = (taskRes.data || [])[0]
	if (!task) return fail(404, '回访任务不存在')
	if (task.enterpriseId !== auth.enterpriseId) return fail(403, '无权操作该任务')

	const now = Date.now()
	await db.collection('followup_log').add({
		enterpriseId: auth.enterpriseId,
		taskId,
		action,
		channel: ACTION_CHANNEL[action],
		operatorUserId: auth.user._id,
		operatorName: auth.user.name || '',
		note: String(event.note || ''),
		createdAt: now
	})

	const nextStatus = ACTION_STATUS[action]
	if (nextStatus) {
		await db.collection('followup_task').doc(taskId).update({
			status: nextStatus,
			updatedAt: now
		})
	}

	return { code: 200, status: 'success', data: { taskId, action, status: nextStatus || task.status } }
}
