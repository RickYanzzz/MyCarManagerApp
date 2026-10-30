'use strict';
const db = uniCloud.database()

exports.main = async (event, context) => {
	const where = { enterpriseId: event.enterpriseId }
	if (event.partId) where.partId = event.partId
	if (event.type) where.type = event.type
	const res = await db.collection('spare_part_logs')
		.where(where)
		.orderBy('createdAt', 'desc')
		.get()
	return { code: 200, status: 'success', data: res.data || [] }
}
