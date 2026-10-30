'use strict';
const db = uniCloud.database()

exports.main = async (event, context) => {
	const id = event._id || event.id
	const updateData = {}
	;['carNumber', 'owner', 'ownerphone', 'carType', 'brand', 'engineNumber', 'frame', 'insure', 'other'].forEach(key => {
		if (event[key] !== undefined) updateData[key] = event[key]
	})
	await db.collection('car_info').doc(id).update(updateData)
	const res = await db.collection('car_info').doc(id).get()
	return { code: 200, status: 'success', data: (res.data || [])[0] || {} }
}
