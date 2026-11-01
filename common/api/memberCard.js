import commoms from "../js/common.js"

/**
 * 会员次卡 / 套餐卡
 */
function callFunction(name, data) {
	const payload = data || {}
	if (commoms && commoms.setDataUserId) commoms.setDataUserId(payload)
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

export const add_member_card = (data) => callFunction("add_member_card", data)
export const get_member_cards = (data) => callFunction("get_member_cards", data)
