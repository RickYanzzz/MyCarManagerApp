'use strict';
const db = uniCloud.database()

exports.main = async (event, context) => {
	const id = event._id || event.id
	const partRes = await db.collection('spare_parts').doc(id).get()
	const part = (partRes.data || [])[0]
	if (!part) {
		return { code: -1, status: 'fail', msg: '备件不存在' }
	}
	const logRes = await db.collection('spare_part_logs').where({ partId: id }).count()
	const hasLogs = (logRes.total || 0) > 0
	if (hasLogs || Number(part.stock || 0) > 0) {
		await db.collection('spare_parts').doc(id).update({ status: 0, updatedAt: Date.now() })
		return { code: 200, status: 'success', data: { disabled: true, id } }
	}
	await db.collection('spare_parts').doc(id).remove()
	return { code: 200, status: 'success', data: { disabled: false, id } }
}
