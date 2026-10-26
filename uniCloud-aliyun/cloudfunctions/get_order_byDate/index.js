'use strict';
const db = uniCloud.database()
const dbCmd = db.command

/**
 * 按日期统计订单（用于首页“今日收入”）
 * 入参: { enterpriseId, status, startTime, endTime }
 * 出参: { code, status, data: [ { ...订单, pay_infoList: [...] } ] }
 *
 * 说明：改用 where() + 手动关联，替代原先的 aggregate().match()，
 * 避免聚合里时间区间条件不生效导致“今日收入恒为 0”。
 */
exports.main = async (event, context) => {
	console.log('get_order_byDate event : ', JSON.stringify(event))

	const enterpriseId = event.enterpriseId
	const status = parseInt(event.status)

	// 时间戳兜底：参数无效时退化为“今天 00:00 ~ 明天 00:00”
	let start = Number(event.startTime)
	let end = Number(event.endTime)
	if (!start || !end || isNaN(start) || isNaN(end)) {
		const zero = new Date()
		zero.setHours(0, 0, 0, 0)
		start = zero.getTime()
		end = start + 24 * 60 * 60 * 1000
	}

	// 1. 取当天完成的订单（按“完成时间”updateTime 过滤）
	const orderRes = await db.collection('order').where({
		enterpriseId: enterpriseId,
		status: status,
		updateTime: dbCmd.gte(start).and(dbCmd.lt(end))
	}).get()

	const orders = orderRes.data || []

	// 2. 关联每单的付款记录（等价于原 aggregate + lookup）
	const data = []
	for (let i = 0; i < orders.length; i++) {
		const order = orders[i]
		const payRes = await db.collection('pay_infos').where({
			orderId: order._id
		}).get()
		order.pay_infoList = payRes.data || []
		data.push(order)
	}

	return {
		code: 200,
		status: "success",
		data: data
	}
};
