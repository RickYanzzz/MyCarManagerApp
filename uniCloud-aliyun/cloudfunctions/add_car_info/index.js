'use strict';
const db = uniCloud.database()
exports.main = async (event, context) => {

	console.log('event : ', event)
	const collection = db.collection('car_info')
	const res = await collection.add({
		userId:event.userId,
		enterpriseId:event.enterpriseId,
		carNumber:event.carNumber,
		type:event.type, //0 临牌 1 车牌 
	})
	console.log("res==="+JSON.stringify(res));
	//返回数据给客户端
	return {
		code:200,
		status:"success",
		data:res
	}
};
