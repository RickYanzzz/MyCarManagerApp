'use strict';
const db = uniCloud.database()
exports.main = async (event, context) => {

	console.log('event : ', event)
	const collection = db.collection('goods')
	const res = await collection.where({
			enterpriseId:event.enterpriseId
	}).get()

	//返回数据给客户端
	return {
		code: 200,
		status: "success",
		data: res.data
	}
};