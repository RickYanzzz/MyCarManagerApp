import commoms from "../js/common.js"

/**
 * 回访相关接口
 * 统一封装：自动带上 userId / enterpriseId，code !== 200 视为失败
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

// 扫描生成今日待回访任务（也可由定时触发器自动跑）
export const followup_scan = (data) => callFunction("followup_scan", data)
// 生成话术；regenerate = true 时忽略 7 天缓存，换一版
export const followup_generate = (data) => callFunction("followup_generate", data)
// 工作台列表：status = open | sent | converted | ignored | all
export const followup_list = (data) => callFunction("followup_list", data)
// 记录动作：copy / wechat / call / sms / sent / ignored / converted
export const followup_mark = (data) => callFunction("followup_mark", data)
// 调试诊断：action = diagnose | seed | clear | test_model
export const followup_debug = (data) => callFunction("followup_debug", data)
