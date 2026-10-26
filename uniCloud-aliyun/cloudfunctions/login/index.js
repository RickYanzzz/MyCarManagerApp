'use strict';
const db = uniCloud.database()
const dcmd = db.command
exports.main = async (event, context) => {
	console.log('event : ', event)
	
	const collection = db.collection('user')
	const res = await collection.where({
		username:event.phoneNumber,
		password:event.password
	}).get()
	console.log('res====== : ', res)
	if(res.data&&res.data.length>0){
		return {
			code:200,
			status:"success",
			data:res.data[0]
		}
	}else{
		return {
			code:400,
			status:"error"
		}
	}
	
	//返回数据给客户端

};
