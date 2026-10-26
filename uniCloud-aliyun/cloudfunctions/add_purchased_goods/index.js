'use strict';
const db = uniCloud.database()
exports.main = async (event, context) => {

	console.log('event : ', event)
	const collection = db.collection('purchased_goods')
	const res = await collection.add({
		userId:event.userId,
		enterpriseId:event.enterpriseId,
		name: event.name,
		fee:event.fee,
		count:event.count,
		orderId:event.orderId,
		carId:event.carId,
		status:event.status
	})
	
	//返回数据给客户端
	return {
		code: 200,
		status: "success",
		data: res
	}
};