import commoms from "../js/common.js"

function callFunction(name, data) {
	const payload = data || {}
	commoms.setDataUserId(payload)
	const user = uni.getStorageSync('userInfo')
	if (user) {
		payload.userId = payload.userId || user._id
		payload.enterpriseId = payload.enterpriseId || user.enterpriseId
		payload.operatorName = payload.operatorName || user.realName || user.username || ''
	}
	return new Promise((resolve, reject) => {
		uniCloud.callFunction({
			name: name,
			data: payload
		}).then((res) => {
			if (res.result && res.result.code == 200) {
				resolve(res.result)
			} else {
				reject(res.result || { code: -1, msg: "请求失败" })
			}
		}).catch((err) => {
			reject(err)
		})
	})
}

export const get_spare_parts = (data) => callFunction("get_spare_parts", data)
export const get_spare_part_by_id = (data) => callFunction("get_spare_part_by_id", data)
export const add_spare_part = (data) => callFunction("add_spare_part", data)
export const update_spare_part = (data) => callFunction("update_spare_part", data)
export const delete_spare_part = (data) => callFunction("delete_spare_part", data)
export const stock_in_spare_part = (data) => callFunction("stock_in_spare_part", data)
export const issue_spare_parts = (data) => callFunction("issue_spare_parts", data)
export const return_spare_part = (data) => callFunction("return_spare_part", data)
export const adjust_spare_part_stock = (data) => callFunction("adjust_spare_part_stock", data)
export const get_spare_part_logs = (data) => callFunction("get_spare_part_logs", data)
