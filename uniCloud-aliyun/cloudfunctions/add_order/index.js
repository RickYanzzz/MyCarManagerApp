'use strict';
const db = uniCloud.database()
exports.main = async (event, context) => {

	console.log('event : ', event)
	const collection = db.collection('order')
	const now = new Date().getTime()
	const res = await collection.add({
		userId:event.userId,
		enterpriseId:event.enterpriseId,
		carInfoId: event.id,
		time:now,
		// updateTime 是“订单完成/入账时间”，下单时先写入，结束订单时会被覆盖为完成时刻。
		// 保证该字段一定存在，今日收入统计才不会漏单。
		updateTime:now,
		status:0
	})
	console.log("res===" + JSON.stringify(res));
	//返回数据给客户端
	return {
		code: 200,
		status: "success",
		data: res
	}
};