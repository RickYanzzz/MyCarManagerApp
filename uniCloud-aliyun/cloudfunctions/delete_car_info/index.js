'use strict';
const db = uniCloud.database()

exports.main = async (event, context) => {
	const id = event._id || event.id
	await db.collection('car_info').doc(id).remove()
	return { code: 200, status: 'success', data: { id } }
}
