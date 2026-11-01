'use strict';
const db = uniCloud.database()
exports.main = async (event, context) => {

	console.log('event : ', event)
	const now = Date.now()
	const doc = {
		userId: event.userId,
		enterpriseId: event.enterpriseId,
		name: event.name,
		fee: event.fee,
		count: event.count,
		orderId: event.orderId,
		carId: event.carId,
		status: event.status,
		// 项目时间：什么时候做的项目，落库即记录；前端可显式传 createdAt 修正
		createdAt: event.createdAt || now
	}
	// 周期快照（前端按 common/js/cycle-presets.js 匹配后传入，可选）
	if (event.category) doc.category = event.category
	if (event.cycleDays) doc.cycleDays = parseInt(event.cycleDays) || 0
	if (event.cycleName) doc.cycleName = event.cycleName

	const collection = db.collection('purchased_goods')
	const res = await collection.add(doc)

	//返回数据给客户端
	return {
		code: 200,
		status: "success",
		data: res
	}
};
