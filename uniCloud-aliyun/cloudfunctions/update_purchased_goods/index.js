'use strict';
const db = uniCloud.database()
exports.main = async (event, context) => {
	console.log('event : ', event)
	const collection = db.collection('purchased_goods')
	const res = await collection.where({
		_id: event._id
	}).updateAndReturn({
		count: event.count,
		fee: event.fee
	})

	//返回数据给客户端
	return {
		code: 200,
		status: "success",
		data: res.data
	}
};