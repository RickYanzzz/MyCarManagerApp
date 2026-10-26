export const login = (data) =>{
	return new Promise((reslove,reject)=>{
		uniCloud.callFunction({
			name:"login",
			data
		}).then((res)=>{
			if(res.result.code == 200){
				console.log("userInfo====",JSON.stringify(res.result));
			   reslove(res.result)
				
			}else{
				reject(res.result)
			}
		}).catch(err=>{
			reject(err)
		})
	})
}

export const get_enterprise = (data) =>{
	return new Promise((reslove,reject)=>{
		uniCloud.callFunction({
			name:"get_enterprise",
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


export const get_user_status = (data) =>{
	return new Promise((reslove,reject)=>{
		uniCloud.callFunction({
			name:"get_user_status",
			data
		}).then((res)=>{
			if(res.result.code == 200){
				console.log("userInfo====",JSON.stringify(res.result));
			   reslove(res.result)
				
			}else{
				reject(res.result)
			}
		}).catch(err=>{
			reject(err)
		})
	})
}