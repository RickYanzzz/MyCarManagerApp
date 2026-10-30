'use strict';
const db = uniCloud.database()
const dbCmd = db.command

exports.main = async (event, context) => {
	const orderId = event.orderId
	const carId = event.carId
	const items = Array.isArray(event.items) ? event.items : []
	if (!orderId || !items.length) {
		return { code: -1, status: 'fail', msg: '请选择备件' }
	}

	const orderRes = await db.collection('order').doc(orderId).get()
	const order = (orderRes.data || [])[0]
	if (!order) {
		return { code: -1, status: 'fail', msg: '工单不存在' }
	}
	const orderStatus = Number(order.status)
	if (orderStatus !== 0 && orderStatus !== 1) {
		return { code: -1, status: 'fail', msg: '只有临时/挂账工单可以添加备件' }
	}

	const transaction = await db.startTransaction()
	const created = []
	try {
		for (let i = 0; i < items.length; i++) {
			const item = items[i]
			const qty = parseInt(item.qty || 0)
			if (!item.partId || qty <= 0) throw new Error('备件数量必须大于 0')
			const partRes = await transaction.collection('spare_parts').doc(item.partId).get()
			const part = (partRes.data || [])[0]
			if (!part) throw new Error('备件不存在')
			const beforeStock = Number(part.stock || 0)
			if (qty > beforeStock) throw new Error(part.name + ' 库存不足（当前 ' + beforeStock + '）')

			await transaction.collection('spare_parts').doc(item.partId).update({
				stock: dbCmd.inc(-qty),
				updatedAt: Date.now()
			})

			const fee = Number(part.salePrice || 0) * qty
			const goods = {
				userId: event.userId || '',
				enterpriseId: event.enterpriseId,
				name: part.name + (part.spec ? ' ' + part.spec : ''),
				fee: fee,
				count: qty,
				orderId: orderId,
				carId: carId || order.carInfoId,
				status: 0,
				source: 'spare_part',
				partId: item.partId,
				spec: part.spec || '',
				unit: part.unit || ''
			}
			const addRes = await transaction.collection('purchased_goods').add(goods)
			goods._id = addRes.id
			created.push(goods)

			await transaction.collection('spare_part_logs').add({
				enterpriseId: event.enterpriseId,
				partId: item.partId,
				partName: part.name,
				type: 'out',
				qty: qty,
				beforeStock: beforeStock,
				afterStock: beforeStock - qty,
				unitPrice: Number(part.salePrice || 0),
				orderId: orderId,
				carId: goods.carId,
				operatorId: event.userId || '',
				operatorName: event.operatorName || '',
				remark: event.remark || '',
				createdAt: Date.now()
			})
		}
		await transaction.commit()
	} catch (e) {
		await transaction.rollback()
		return { code: -1, status: 'fail', msg: e.message || '出库失败' }
	}

	return { code: 200, status: 'success', data: { items: created } }
}
