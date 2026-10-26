'use strict';
const db = uniCloud.database()
exports.main = async (event, context) => {

	console.log('event : ', event)
	const collection = db.collection('pay_infos')
	const res = await collection.where({
		enterpriseId:event.enterpriseId, 
		carId: event.carId,
		orderId:event.orderId
	}).get()
	
	//返回数据给客户端
	return {
		code: 200,
		status: "success",
		data: res.data
	}
};