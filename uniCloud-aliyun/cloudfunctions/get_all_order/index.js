'use strict';
const db = uniCloud.database()
exports.main = async (event, context) => {

	console.log('event : ', event)
	const res = await db.collection('order').aggregate().
	  match({
		enterpriseId:event.enterpriseId, 
	    status: parseInt(event.status),
		
	  }).
	lookup({
			from: "car_info",
			localField: "carInfoId",
			foreignField: "_id",
			as: "carInfoList"
		}).
	lookup({
			from: "purchased_goods",
			localField: "_id",
			foreignField: "orderId",
			as: "purchasedList"
		}).lookup({
			from: "pay_infos",
			localField: "_id",
			foreignField: "orderId",
			as: "pay_infoList"
		})
		.end()
	// .match({
	// 	// "order": {
	// 	// 	status: event.status
	// 	// }
	// }).project({
	// 	"carInfo.carNumber":true
	// }).end()
	console.log("re1====" + JSON.stringify(res))
	// const res = await collection.where({
	// 	 status:event.status
	// }).get()
	// const collection = db.collection('order')
	let data = {}
	if (res.data && res.data.length > 0) {
		data = res.data
	}
	//返回数据给客户端
	return {
		code: 200,
		status: "success",
		data: data
	}
};