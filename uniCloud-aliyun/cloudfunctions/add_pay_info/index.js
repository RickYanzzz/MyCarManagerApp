'use strict';
const db = uniCloud.database()
exports.main = async (event, context) => {

	console.log('event : ', event)
	const collection = db.collection('pay_infos')
	const res = await collection.add({
		userId:event.userId,
		enterpriseId:event.enterpriseId,
		name: event.name,
		type: event.type,
		fee: event.fee,
		userId: event.userId,
		enterpriseId: event.enterpriseId,
		orderId: event.orderId,
		carId: event.carId

	})

	//返回数据给客户端
	return {
		code: 200,
		status: "success",
		data: res
	}
};