'use strict';
const db = uniCloud.database()

exports.main = async (event, context) => {
	const id = event._id || event.id
	const updateData = { updatedAt: Date.now() }
	;['name', 'spec', 'unit', 'location', 'supplier'].forEach(key => {
		if (event[key] !== undefined) updateData[key] = event[key]
	})
	;['safetyStock', 'costPrice', 'salePrice', 'status'].forEach(key => {
		if (event[key] !== undefined) updateData[key] = parseInt(event[key])
	})

	await db.collection('spare_parts').doc(id).update(updateData)
	const res = await db.collection('spare_parts').doc(id).get()
	return { code: 200, status: 'success', data: (res.data || [])[0] || {} }
}
