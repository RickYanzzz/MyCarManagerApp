import commoms from "../js/common.js"
export const addOrder = (data) =>{
	commoms.setDataUserId(data)
	return new Promise((reslove,reject)=>{
		uniCloud.callFunction({
			name:"add_order",
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
export const get_order_byId = (data) =>{
	return new Promise((reslove,reject)=>{
		uniCloud.callFunction({
			name:"get_odred_byId",
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

export const get_order_byStatus = (data) =>{
	commoms.setDataUserId(data)
	return new Promise((reslove,reject)=>{
		uniCloud.callFunction({
			name:"get_all_order",
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


export const delete_order = (data) =>{
	commoms.setDataUserId(data)
	data.updateTime=new Date().getTime()
	return new Promise((reslove,reject)=>{
		uniCloud.callFunction({
			name:"delete_order",
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


export const get_order_byDate = (data) =>{
	commoms.setDataUserId(data)
	return new Promise((reslove,reject)=>{
		uniCloud.callFunction({
			name:"get_order_byDate",
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