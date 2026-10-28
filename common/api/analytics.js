import commoms from "../js/common.js"
import { buildMockAnalytics } from "../js/analytics-mock.js"

/**
 * 经营数据统计接口封装
 *
 * 注意 USE_MOCK 开关：
 * - true  ：使用本地模拟数据。当前项目没有可信登录态，统计云函数不允许部署到
 *           共享/正式空间，因此默认必须是 true，保证页面可独立运行且不碰真实数据。
 * - false ：走真实云函数 analytics_summary。切换前请确认：
 *           1) 云函数已部署到**独立测试空间**，且该空间数据与正式门店隔离；
 *           2) 已设置环境变量 ANALYTICS_TRUSTED_AUTH = on（否则函数会返回 403）。
 */
const USE_MOCK = true

// 模拟网络耗时，便于观察加载态
const MOCK_DELAY = 350

export const get_analytics_summary = (data) => {
	const payload = data || {}

	if (USE_MOCK) {
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve(buildMockAnalytics(Number(payload.range) || 7))
			}, MOCK_DELAY)
		})
	}

	// 与项目其它接口保持一致：只传 userId，门店由云函数在服务端反查，
	// 避免客户端伪造 enterpriseId 读取别家门店数据。
	commoms.setDataUserId(payload)
	delete payload.enterpriseId

	return new Promise((resolve, reject) => {
		uniCloud.callFunction({
			name: "analytics_summary",
			data: payload
		}).then((res) => {
			if (res.result && res.result.code == 200) {
				resolve(res.result)
			} else {
				reject(res.result)
			}
		}).catch(err => {
			reject(err)
		})
	})
}
