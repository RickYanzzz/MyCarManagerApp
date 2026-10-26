'use strict';
const db = uniCloud.database()
exports.main = async (event, context) => {

	console.log('event : ', event)
	const collection = db.collection('enterprise')
	const res = await collection.where({
		_id:event.enterpriseId
	}).get()
	let data = {}
	if(res.data&&res.data.length>0){
		data = res.data[0]
	}
	//返回数据给客户端
	return {
		code:200,
		status:"success",
		data:data
	}
};
