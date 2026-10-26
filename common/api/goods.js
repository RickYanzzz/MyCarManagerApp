import commoms from "../js/common.js"
export const get_hot_goods = (data) =>{
	return new Promise((reslove,reject)=>{
		commoms.setDataUserId(data)
		uniCloud.callFunction({
			name:"get_hot_goods",
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


export const get_All_goods = (data) =>{
	commoms.setDataUserId(data)
	return new Promise((reslove,reject)=>{
		uniCloud.callFunction({
			name:"get_All_goods",
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