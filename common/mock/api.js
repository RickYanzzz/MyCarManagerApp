/**
 * 本地 mock API
 * 与 common/api/index.js 导出的 $api 方法保持一致。
 * 只在开发模式生效，数据保存在 uni.setStorageSync。
 */
import { loadDb, saveDb, resetMockDb, makeId } from './db.js'

function clone(value) {
	return JSON.parse(JSON.stringify(value))
}

function ok(data) {
	return Promise.resolve({
		code: 200,
		status: 'success',
		data: data
	})
}

function fail(msg) {
	return Promise.reject({
		code: -1,
		msg: msg || '操作失败',
		errMsg: msg || '操作失败'
	})
}

function currentUser(db) {
	return uni.getStorageSync('userInfo') || (db.user && db.user[0]) || {}
}

function currentEnterpriseId(db) {
	const user = currentUser(db)
	return user.enterpriseId || 'ent_demo_0001'
}

function findById(list, id) {
	return (list || []).find(item => item._id === id)
}

function now() {
	return Date.now()
}

function toInt(value, defaultValue) {
	const n = parseInt(value)
	return isNaN(n) ? (defaultValue || 0) : n
}

/* ---------------- 登录 / 企业 ---------------- */

function login(data) {
	const db = loadDb()
	const account = data.phoneNumber || data.username || ''
	const password = data.password || ''
	const user = db.user.find(item =>
		(item.phoneNumber === account || item.username === account || item.phoneNumber === String(account)) &&
		item.password === password
	)
	if (!user) return fail('手机号或密码错误')
	if (user.status === 0 || user.status === false) return fail('账号已被禁用')
	return ok(clone(user))
}

function get_enterprise(data) {
	const db = loadDb()
	const enterprise = findById(db.enterprise, data.enterpriseId) || db.enterprise[0]
	return ok(clone(enterprise || {}))
}

function get_user_status(data) {
	const db = loadDb()
	const user = findById(db.user, data.id) || currentUser(db)
	return ok(clone(user || {}))
}

/* ---------------- 车辆 ---------------- */

function get_car_info_byId(data) {
	const db = loadDb()
	const car = findById(db.car_info, data.carInfoId || data.id)
	return ok(clone(car || {}))
}

function get_car_info_by_carNumber(data) {
	const db = loadDb()
	const number = String(data.carNumber || '').trim()
	const car = db.car_info.find(item => item.carNumber === number)
	return ok(clone(car || {}))
}

function get_car_info_list(data) {
	const db = loadDb()
	const enterpriseId = data.enterpriseId || currentEnterpriseId(db)
	const keyword = String(data.keyword || '').trim().toLowerCase()
	let list = db.car_info.filter(item => item.enterpriseId === enterpriseId)
	if (keyword) {
		list = list.filter(item =>
			String(item.carNumber || '').toLowerCase().indexOf(keyword) > -1 ||
			String(item.owner || '').toLowerCase().indexOf(keyword) > -1 ||
			String(item.ownerphone || '').toLowerCase().indexOf(keyword) > -1
		)
	}
	return ok(clone(list))
}

function addcar(data) {
	const db = loadDb()
	const user = currentUser(db)
	const car = {
		_id: makeId('car'),
		userId: user._id || 'user_demo_0001',
		enterpriseId: user.enterpriseId || currentEnterpriseId(db),
		carNumber: data.carNumber || '',
		owner: data.owner || '',
		ownerphone: data.ownerphone || '',
		carType: data.carType || data.type || '',
		brand: data.brand || '',
		engineNumber: data.engineNumber || '',
		frame: data.frame || '',
		insure: data.insure || null,
		other: data.other || ''
	}
	db.car_info.push(car)
	saveDb(db)
	return ok({ id: car._id })
}

function update_car_info(data) {
	const db = loadDb()
	const car = findById(db.car_info, data._id)
	if (!car) return fail('车辆不存在')
	;['carNumber', 'owner', 'ownerphone', 'carType', 'brand', 'engineNumber', 'frame', 'insure', 'other'].forEach(key => {
		if (data[key] !== undefined) car[key] = data[key]
	})
	saveDb(db)
	return ok(clone(car))
}

function delete_car_info(data) {
	const db = loadDb()
	const index = db.car_info.findIndex(item => item._id === data._id)
	if (index < 0) return fail('车辆不存在')
	db.car_info.splice(index, 1)
	saveDb(db)
	return ok({ id: data._id })
}

/* ---------------- 订单 ---------------- */

function addOrder(data) {
	const db = loadDb()
	const user = currentUser(db)
	const order = {
		_id: makeId('order'),
		userId: user._id || 'user_demo_0001',
		enterpriseId: user.enterpriseId || currentEnterpriseId(db),
		carInfoId: data.id || data.carInfoId,
		time: now(),
		status: 0,
		updateTime: now()
	}
	db.order.push(order)
	saveDb(db)
	return ok({ id: order._id })
}

function get_order_byId(data) {
	const db = loadDb()
	const order = findById(db.order, data.id || data._id)
	return ok(clone(order || {}))
}

function get_order_byStatus(data) {
	const db = loadDb()
	const enterpriseId = data.enterpriseId || currentEnterpriseId(db)
	const status = toInt(data.status, 0)
	const list = db.order
		.filter(item => item.enterpriseId === enterpriseId && toInt(item.status, 0) === status)
		.map(order => Object.assign({}, order, {
			carInfoList: db.car_info.filter(car => car._id === order.carInfoId),
			purchasedList: db.purchased_goods.filter(goods => goods.orderId === order._id),
			pay_infoList: db.pay_infos.filter(pay => pay.orderId === order._id)
		}))
	return ok(clone(list))
}

function delete_order(data) {
	const db = loadDb()
	const order = findById(db.order, data._id)
	if (!order) return fail('订单不存在')
	order.status = toInt(data.status, order.status)
	order.updateTime = data.updateTime || now()
	saveDb(db)
	return ok(clone(order))
}

function get_order_byDate(data) {
	const db = loadDb()
	const enterpriseId = data.enterpriseId || currentEnterpriseId(db)
	const status = toInt(data.status, 2)
	let start = Number(data.startTime)
	let end = Number(data.endTime)
	if (!start || !end || isNaN(start) || isNaN(end)) {
		const zero = new Date()
		zero.setHours(0, 0, 0, 0)
		start = zero.getTime()
		end = start + 24 * 60 * 60 * 1000
	}
	const list = db.order
		.filter(order => order.enterpriseId === enterpriseId &&
			toInt(order.status, 0) === status &&
			Number(order.updateTime || 0) >= start &&
			Number(order.updateTime || 0) < end)
		.map(order => Object.assign({}, order, {
			pay_infoList: db.pay_infos.filter(pay => pay.orderId === order._id)
		}))
	return ok(clone(list))
}

/* ---------------- 商品 / 消费项目 ---------------- */

function get_hot_goods() {
	const db = loadDb()
	return ok(clone(db.goods.filter(item => item.hotStatus === true)))
}

function get_All_goods(data) {
	const db = loadDb()
	const enterpriseId = data && data.enterpriseId ? data.enterpriseId : currentEnterpriseId(db)
	return ok(clone(db.goods.filter(item => !item.enterpriseId || item.enterpriseId === enterpriseId)))
}

function get_purchased_goods(data) {
	const db = loadDb()
	const list = db.purchased_goods.filter(item => {
		if (data.orderId && item.orderId !== data.orderId) return false
		if (data.carId && item.carId !== data.carId) return false
		if (data.status !== undefined && data.status !== null && data.status !== '' && toInt(item.status, 0) !== toInt(data.status, 0)) return false
		return true
	})
	return ok(clone(list))
}

function add_purchased_goods(data) {
	const db = loadDb()
	const user = currentUser(db)
	const goods = {
		_id: makeId('pg'),
		userId: data.userId || user._id || 'user_demo_0001',
		enterpriseId: data.enterpriseId || user.enterpriseId || currentEnterpriseId(db),
		name: data.name || '',
		fee: toInt(data.fee, 0),
		count: toInt(data.count, 1),
		orderId: data.orderId || '',
		carId: data.carId || '',
		status: data.status === undefined ? 0 : toInt(data.status, 0),
		source: data.source || 'goods',
		partId: data.partId || '',
		spec: data.spec || '',
		unit: data.unit || ''
	}
	db.purchased_goods.push(goods)
	saveDb(db)
	return ok({ id: goods._id })
}

function update_purchased_goods(data) {
	const db = loadDb()
	const goods = findById(db.purchased_goods, data._id)
	if (!goods) return fail('消费项目不存在')
	if (goods.source === 'spare_part') return fail('备件费用请通过“退料”处理')
	if (data.count !== undefined) goods.count = toInt(data.count, goods.count)
	if (data.fee !== undefined) goods.fee = toInt(data.fee, goods.fee)
	saveDb(db)
	return ok(clone(goods))
}

function delete_purchased_goods(data) {
	const db = loadDb()
	const goods = findById(db.purchased_goods, data._id)
	if (!goods) return fail('消费项目不存在')
	if (goods.source === 'spare_part') return fail('备件费用请通过“退料”处理')
	const index = db.purchased_goods.findIndex(item => item._id === data._id)
	db.purchased_goods.splice(index, 1)
	saveDb(db)
	return ok({ id: data._id })
}

/* ---------------- 收款 ---------------- */

function add_pay_info(data) {
	const db = loadDb()
	const user = currentUser(db)
	const pay = {
		_id: makeId('pay'),
		userId: data.userId || user._id || 'user_demo_0001',
		enterpriseId: data.enterpriseId || user.enterpriseId || currentEnterpriseId(db),
		name: data.name || '',
		type: toInt(data.type, 1),
		fee: toInt(data.fee, 0),
		orderId: data.orderId || '',
		carId: data.carId || ''
	}
	db.pay_infos.push(pay)
	saveDb(db)
	return ok({ id: pay._id })
}

function get_pay_info(data) {
	const db = loadDb()
	const list = db.pay_infos.filter(item => {
		if (data.orderId && item.orderId !== data.orderId) return false
		if (data.carId && item.carId !== data.carId) return false
		return true
	})
	return ok(clone(list))
}

function delete_pay_info(data) {
	const db = loadDb()
	const index = db.pay_infos.findIndex(item => item._id === data._id)
	if (index < 0) return fail('收款记录不存在')
	db.pay_infos.splice(index, 1)
	saveDb(db)
	return ok({ id: data._id })
}

/* ---------------- OCR（演示） ---------------- */

function ocrLicensePlate() {
	return ok({ number: '粤A12345', color: '蓝' })
}

/* ---------------- 备品备件 ---------------- */

function generatePartCode(db, enterpriseId) {
	let max = 0
	db.spare_parts
		.filter(item => item.enterpriseId === enterpriseId)
		.forEach(item => {
			const n = parseInt(String(item.code || '').replace(/[^0-9]/g, ''))
			if (!isNaN(n) && n > max) max = n
		})
	return 'SP' + String(max + 1).padStart(4, '0')
}

function get_spare_parts(data) {
	const db = loadDb()
	const enterpriseId = data.enterpriseId || currentEnterpriseId(db)
	const keyword = String(data.keyword || '').trim().toLowerCase()
	const lowStockOnly = data.lowStockOnly === true || data.lowStockOnly === 'true'
	let list = db.spare_parts.filter(item => {
		if (item.enterpriseId !== enterpriseId) return false
		if (!data.includeDisabled && toInt(item.status, 1) !== 1) return false
		if (keyword) {
			const text = [item.code, item.name, item.spec, item.supplier].join(' ').toLowerCase()
			if (text.indexOf(keyword) < 0) return false
		}
		if (lowStockOnly && toInt(item.stock, 0) > toInt(item.safetyStock, 0)) return false
		return true
	})
	list = clone(list).sort((a, b) => {
		const aLow = toInt(a.stock, 0) <= toInt(a.safetyStock, 0) ? 1 : 0
		const bLow = toInt(b.stock, 0) <= toInt(b.safetyStock, 0) ? 1 : 0
		if (aLow !== bLow) return bLow - aLow
		return String(a.code || '').localeCompare(String(b.code || ''))
	})
	return ok(list)
}

function get_spare_part_by_id(data) {
	const db = loadDb()
	const part = findById(db.spare_parts, data.id || data._id)
	if (!part) return fail('备件不存在')
	const logs = db.spare_part_logs
		.filter(log => log.partId === part._id)
		.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
	return Promise.resolve({
		code: 200,
		status: 'success',
		data: clone(part),
		logs: clone(logs)
	})
}

function add_spare_part(data) {
	const db = loadDb()
	const user = currentUser(db)
	const enterpriseId = data.enterpriseId || user.enterpriseId || currentEnterpriseId(db)
	const part = {
		_id: makeId('part'),
		enterpriseId: enterpriseId,
		code: data.code || generatePartCode(db, enterpriseId),
		name: String(data.name || '').trim(),
		spec: data.spec || '',
		unit: data.unit || '个',
		stock: toInt(data.stock, 0),
		safetyStock: toInt(data.safetyStock, 0),
		location: data.location || '',
		supplier: data.supplier || '',
		costPrice: toInt(data.costPrice, 0),
		salePrice: toInt(data.salePrice, 0),
		status: data.status === undefined ? 1 : toInt(data.status, 1),
		createdAt: now(),
		updatedAt: now()
	}
	if (!part.name) return fail('备件名称不能为空')
	db.spare_parts.push(part)
	if (part.stock > 0) {
		db.spare_part_logs.push({
			_id: makeId('log'),
			enterpriseId: enterpriseId,
			partId: part._id,
			partName: part.name,
			type: 'in',
			qty: part.stock,
			beforeStock: 0,
			afterStock: part.stock,
			unitPrice: part.costPrice,
			orderId: '',
			carId: '',
			operatorId: user._id || '',
			operatorName: user.realName || user.username || '管理员',
			remark: '新增备件初始库存',
			createdAt: now()
		})
	}
	saveDb(db)
	return ok(clone(part))
}

function update_spare_part(data) {
	const db = loadDb()
	const part = findById(db.spare_parts, data._id || data.id)
	if (!part) return fail('备件不存在')
	;['name', 'spec', 'unit', 'location', 'supplier'].forEach(key => {
		if (data[key] !== undefined) part[key] = data[key]
	})
	;['safetyStock', 'costPrice', 'salePrice', 'status'].forEach(key => {
		if (data[key] !== undefined) part[key] = toInt(data[key], part[key])
	})
	part.updatedAt = now()
	saveDb(db)
	return ok(clone(part))
}

function delete_spare_part(data) {
	const db = loadDb()
	const part = findById(db.spare_parts, data.id || data._id)
	if (!part) return fail('备件不存在')
	const hasLogs = db.spare_part_logs.some(log => log.partId === part._id)
	if (hasLogs || toInt(part.stock, 0) > 0) {
		part.status = 0
		part.updatedAt = now()
		saveDb(db)
		return ok({ disabled: true, part: clone(part) })
	}
	const index = db.spare_parts.findIndex(item => item._id === part._id)
	db.spare_parts.splice(index, 1)
	saveDb(db)
	return ok({ disabled: false, id: part._id })
}

function stock_in_spare_part(data) {
	const db = loadDb()
	const part = findById(db.spare_parts, data.partId)
	if (!part) return fail('备件不存在')
	const qty = toInt(data.qty, 0)
	if (qty <= 0) return fail('入库数量必须大于 0')
	const beforeStock = toInt(part.stock, 0)
	part.stock = beforeStock + qty
	if (data.unitCost !== undefined && data.unitCost !== '') part.costPrice = toInt(data.unitCost, part.costPrice)
	if (data.supplier) part.supplier = data.supplier
	part.updatedAt = now()
	const user = currentUser(db)
	db.spare_part_logs.push({
		_id: makeId('log'),
		enterpriseId: part.enterpriseId,
		partId: part._id,
		partName: part.name,
		type: 'in',
		qty: qty,
		beforeStock: beforeStock,
		afterStock: part.stock,
		unitPrice: toInt(data.unitCost, part.costPrice),
		orderId: '',
		carId: '',
		operatorId: user._id || '',
		operatorName: user.realName || user.username || '管理员',
		remark: data.remark || '',
		createdAt: now()
	})
	saveDb(db)
	return ok(clone(part))
}

function issue_spare_parts(data) {
	const db = loadDb()
	const order = findById(db.order, data.orderId)
	if (!order) return fail('工单不存在')
	const orderStatus = toInt(order.status, 0)
	if (orderStatus !== 0 && orderStatus !== 1) return fail('只有临时/挂账工单可以添加备件')
	const items = Array.isArray(data.items) ? data.items : []
	if (!items.length) return fail('请选择备件')
	const user = currentUser(db)
	const created = []
	for (let i = 0; i < items.length; i++) {
		const item = items[i]
		const part = findById(db.spare_parts, item.partId)
		if (!part) return fail('备件不存在：' + item.partId)
		const qty = toInt(item.qty, 0)
		if (qty <= 0) return fail('备件数量必须大于 0')
		const beforeStock = toInt(part.stock, 0)
		if (qty > beforeStock) return fail(part.name + ' 库存不足（当前 ' + beforeStock + '）')
		part.stock = beforeStock - qty
		part.updatedAt = now()
		const fee = toInt(part.salePrice, 0) * qty
		const goods = {
			_id: makeId('pg'),
			userId: user._id || 'user_demo_0001',
			enterpriseId: part.enterpriseId,
			name: part.name + (part.spec ? ' ' + part.spec : ''),
			fee: fee,
			count: qty,
			orderId: data.orderId,
			carId: data.carId || order.carInfoId,
			status: 0,
			source: 'spare_part',
			partId: part._id,
			spec: part.spec || '',
			unit: part.unit || ''
		}
		db.purchased_goods.push(goods)
		db.spare_part_logs.push({
			_id: makeId('log'),
			enterpriseId: part.enterpriseId,
			partId: part._id,
			partName: part.name,
			type: 'out',
			qty: qty,
			beforeStock: beforeStock,
			afterStock: part.stock,
			unitPrice: toInt(part.salePrice, 0),
			orderId: data.orderId,
			carId: goods.carId,
			operatorId: user._id || '',
			operatorName: user.realName || user.username || '管理员',
			remark: data.remark || '',
			createdAt: now()
		})
		created.push(goods)
	}
	saveDb(db)
	return ok({ items: clone(created) })
}

function return_spare_part(data) {
	const db = loadDb()
	const goods = findById(db.purchased_goods, data.id || data._id)
	if (!goods) return fail('备件费用行不存在')
	if (goods.source !== 'spare_part') return fail('只有备件费用可以退料')
	const part = findById(db.spare_parts, goods.partId)
	if (!part) return fail('备件档案不存在')
	const qty = toInt(data.qty, 0)
	if (qty <= 0) return fail('退料数量必须大于 0')
	if (qty > toInt(goods.count, 0)) return fail('退料数量不能大于已用数量')
	const beforeStock = toInt(part.stock, 0)
	part.stock = beforeStock + qty
	part.updatedAt = now()
	const goodsCount = toInt(goods.count, 0)
	const unitPrice = goodsCount > 0 ? Math.round(toInt(goods.fee, 0) / goodsCount) : toInt(part.salePrice, 0)
	if (qty === toInt(goods.count, 0)) {
		const index = db.purchased_goods.findIndex(item => item._id === goods._id)
		db.purchased_goods.splice(index, 1)
	} else {
		goods.count = toInt(goods.count, 0) - qty
		goods.fee = Math.max(0, toInt(goods.fee, 0) - unitPrice * qty)
	}
	const user = currentUser(db)
	db.spare_part_logs.push({
		_id: makeId('log'),
		enterpriseId: part.enterpriseId,
		partId: part._id,
		partName: part.name,
		type: 'return',
		qty: qty,
		beforeStock: beforeStock,
		afterStock: part.stock,
		unitPrice: unitPrice,
		orderId: goods.orderId,
		carId: goods.carId,
		operatorId: user._id || '',
		operatorName: user.realName || user.username || '管理员',
		remark: data.remark || '退料',
		createdAt: now()
	})
	saveDb(db)
	return ok({ qty: qty })
}

function adjust_spare_part_stock(data) {
	const db = loadDb()
	const part = findById(db.spare_parts, data.partId)
	if (!part) return fail('备件不存在')
	const actualStock = toInt(data.actualStock, -1)
	if (actualStock < 0) return fail('实际库存不能小于 0')
	const beforeStock = toInt(part.stock, 0)
	const diff = actualStock - beforeStock
	part.stock = actualStock
	part.updatedAt = now()
	const user = currentUser(db)
	db.spare_part_logs.push({
		_id: makeId('log'),
		enterpriseId: part.enterpriseId,
		partId: part._id,
		partName: part.name,
		type: 'adjust',
		qty: diff,
		beforeStock: beforeStock,
		afterStock: actualStock,
		unitPrice: toInt(part.costPrice, 0),
		orderId: '',
		carId: '',
		operatorId: user._id || '',
		operatorName: user.realName || user.username || '管理员',
		remark: data.remark || '盘点调整',
		createdAt: now()
	})
	saveDb(db)
	return ok(clone(part))
}

function get_spare_part_logs(data) {
	const db = loadDb()
	const list = db.spare_part_logs
		.filter(log => {
			if (data.partId && log.partId !== data.partId) return false
			if (data.type && log.type !== data.type) return false
			return true
		})
		.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
	return ok(clone(list))
}

/* ---------------- 调试辅助 ---------------- */

function resetMockData() {
	const db = resetMockDb()
	return ok({ reset: true, collections: Object.keys(db) })
}

export default {
	login,
	get_enterprise,
	get_user_status,
	get_car_info_byId,
	get_car_info_by_carNumber,
	get_car_info_list,
	addcar,
	update_car_info,
	delete_car_info,
	addOrder,
	get_order_byId,
	get_order_byStatus,
	delete_order,
	get_order_byDate,
	get_hot_goods,
	get_All_goods,
	get_purchased_goods,
	add_purchased_goods,
	update_purchased_goods,
	delete_purchased_goods,
	add_pay_info,
	get_pay_info,
	delete_pay_info,
	ocrLicensePlate,
	get_spare_parts,
	get_spare_part_by_id,
	add_spare_part,
	update_spare_part,
	delete_spare_part,
	stock_in_spare_part,
	issue_spare_parts,
	return_spare_part,
	adjust_spare_part_stock,
	get_spare_part_logs,
	resetMockData
}
