import commoms from "../js/common.js"

function callFunction(name, data) {
	const payload = data || {}
	commoms.setDataUserId(payload)
	const user = uni.getStorageSync('userInfo')
	if (user) {
		payload.userId = payload.userId || user._id
		payload.enterpriseId = payload.enterpriseId || user.enterpriseId
	}
	return new Promise((resolve, reject) => {
		uniCloud.callFunction({
			name: name,
			data: payload
		}).then((res) => {
			if (res.result && res.result.code == 200) {
				resolve(res.result)
			} else {
				reject(res.result || { code: -1, message: '请求失败' })
			}
		}).catch((err) => {
			reject(err)
		})
	})
}

export const add_member = (data) => callFunction("add_member", data)
export const get_member = (data) => callFunction("get_member", data)
export const list_members = (data) => callFunction("list_members", data)
export const update_member = (data) => callFunction("update_member", data)
export const set_member_status = (data) => callFunction("set_member_status", data)
export const bind_member_car = (data) => callFunction("bind_member_car", data)
export const recharge_member = (data) => callFunction("recharge_member", data)
export const consume_member_balance = (data) => callFunction("consume_member_balance", data)
export const get_member_transactions = (data) => callFunction("get_member_transactions", data)
