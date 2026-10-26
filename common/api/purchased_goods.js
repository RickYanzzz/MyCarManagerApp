import commoms from "../js/common.js"
export const add_purchased_goods = (data) =>{
	commoms.setDataUserId(data)
	return new Promise((reslove,reject)=>{
		uniCloud.callFunction({
			name:"add_purchased_goods",
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


export const get_purchased_goods = (data) =>{
	commoms.setDataUserId(data)
	return new Promise((reslove,reject)=>{
		uniCloud.callFunction({
			name:"get_purchased_goods",
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

export const delete_purchased_goods = (data) =>{
	return new Promise((reslove,reject)=>{
		uniCloud.callFunction({
			name:"delete_purchased_goods",
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


export const update_purchased_goods = (data) =>{
	return new Promise((reslove,reject)=>{
		uniCloud.callFunction({
			name:"update_purchased_goods",
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