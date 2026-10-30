'use strict';
const db = uniCloud.database()

exports.main = async (event, context) => {
	const id = event.id || event._id
	const partRes = await db.collection('spare_parts').doc(id).get()
	const part = (partRes.data || [])[0]
	if (!part) {
		return { code: -1, status: 'fail', msg: '备件不存在' }
	}
	const logRes = await db.collection('spare_part_logs')
		.where({ partId: id })
		.orderBy('createdAt', 'desc')
		.get()
	return { code: 200, status: 'success', data: part, logs: logRes.data || [] }
}
