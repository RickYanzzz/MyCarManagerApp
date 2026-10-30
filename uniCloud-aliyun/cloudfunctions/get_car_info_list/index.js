'use strict';
const db = uniCloud.database()

exports.main = async (event, context) => {
	const enterpriseId = event.enterpriseId
	const keyword = String(event.keyword || '').trim().toLowerCase()
	const res = await db.collection('car_info').where({ enterpriseId }).get()
	let list = res.data || []
	if (keyword) {
		list = list.filter(item => {
			const text = [item.carNumber, item.owner, item.ownerphone, item.brand].join(' ').toLowerCase()
			return text.indexOf(keyword) > -1
		})
	}
	return { code: 200, status: 'success', data: list }
}
