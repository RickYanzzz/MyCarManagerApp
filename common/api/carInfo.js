import commoms from "../js/common.js"
export const addcar = (data) =>{
	return new Promise((reslove,reject)=>{
		commoms.setDataUserId(data)
		uniCloud.callFunction({
			name:"add_car_info",
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


export const get_car_info_byId = (data) =>{
	commoms.setDataUserId(data)
	return new Promise((reslove,reject)=>{
		uniCloud.callFunction({
			name:"get_car_info_by_id",
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


export const get_car_info_by_carNumber = (data) =>{
	commoms.setDataUserId(data)
	return new Promise((reslove,reject)=>{
		uniCloud.callFunction({
			name:"get_car_info_by_carNumber",
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
