import commoms from "../js/common.js"
export const add_pay_info = (data) =>{
	commoms.setDataUserId(data)
	return new Promise((reslove,reject)=>{
		uniCloud.callFunction({
			name:"add_pay_info",
			data
		}).then((res)=>{
			if(res.result.code == 200){
			
			   reslove(res.result)
				
			}else{
				reject(res.result)
			}
		}).catch(err=>{
			reject(err)
		})
	})
}

export const get_pay_info = (data) =>{
	commoms.setDataUserId(data)
	return new Promise((reslove,reject)=>{
		uniCloud.callFunction({
			name:"get_pay_info",
			data
		}).then((res)=>{
			if(res.result.code == 200){
			
			   reslove(res.result)
				
			}else{
				reject(res.result)
			}
		}).catch(err=>{
			reject(err)
		})
	})
}

export const delete_pay_info = (data) =>{
	commoms.setDataUserId(data)
	return new Promise((reslove,reject)=>{
		uniCloud.callFunction({
			name:"delete_pay_info",
			data
		}).then((res)=>{
			if(res.result.code == 200){
			
			   reslove(res.result)
				
			}else{
				reject(res.result)
			}
		}).catch(err=>{
			reject(err)
		})
	})
}