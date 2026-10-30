'use strict';
const db = uniCloud.database()

exports.main = async (event, context) => {
	const collection = db.collection('car_info')
	const data = {
		userId: event.userId,
		enterpriseId: event.enterpriseId,
		carNumber: event.carNumber || '',
		owner: event.owner || '',
		ownerphone: event.ownerphone || '',
		carType: event.carType || event.type || '',
		brand: event.brand || '',
		engineNumber: event.engineNumber || '',
		frame: event.frame || '',
		insure: event.insure || null,
		other: event.other || ''
	}
	const res = await collection.add(data)
	return {
		code: 200,
		status: 'success',
		data: res
	}
}
