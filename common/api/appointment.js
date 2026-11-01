import commoms from "../js/common.js"

/**
 * 预约排班 API
 * 全部走同一个云函数 appointment_api，用 action 区分操作。
 * 与项目其他模块保持一致：成功后 resolve(res.result)，失败 reject(res.result)，
 * 调用方可以用 err.message / err.code 做提示（如 409 表示时段冲突）。
 */
function call(action, data) {
	const payload = Object.assign({}, data, { action })
	commoms.setDataUserId(payload)
	return new Promise((resolve, reject) => {
		uniCloud.callFunction({
			name: "appointment_api",
			data: payload
		}).then((res) => {
			const result = (res && res.result) || {}
			if (result.code == 200) {
				resolve(result)
			} else {
				reject(result)
			}
		}).catch((err) => {
			reject(err)
		})
	})
}

/** 看板：某一天的师傅、时段、预约、服务项目 */
export const get_appointment_board = (data) => call('board', data)

/** 单条预约详情（含同师傅当天其他预约，便于判断改约空间） */
export const get_appointment_detail = (data) => call('detail', data)

/** 某位客户的预约记录（客户详情页用） */
export const get_appointment_by_member = (data) => call('byMember', data)

/** 新增或编辑预约，服务端会再次做冲突校验 */
export const save_appointment = (data) => call('save', data)

/** 改状态：0 待到店 1 施工中 2 已完成 3 已取消 4 未到店 */
export const set_appointment_status = (data) => call('status', data)

/** 一键转开单：生成工单与消费项目，并回写预约 */
export const appointment_to_order = (data) => call('toOrder', data)

/** 把员工标记为师傅（value=false 取消标记；不传 userIds 表示全店） */
export const set_technician = (data) => call('setTechnician', data)
