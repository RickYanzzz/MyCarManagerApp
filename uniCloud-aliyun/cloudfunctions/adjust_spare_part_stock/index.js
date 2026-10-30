'use strict';
const db = uniCloud.database()

exports.main = async (event, context) => {
	const partId = event.partId
	const actualStock = parseInt(event.actualStock)
	if (!partId || isNaN(actualStock) || actualStock < 0) {
		return { code: -1, status: 'fail', msg: '实际库存不能小于 0' }
	}
	const transaction = await db.startTransaction()
	try {
		const partRes = await transaction.collection('spare_parts').doc(partId).get()
		const part = (partRes.data || [])[0]
		if (!part) {
			await transaction.rollback()
			return { code: -1, status: 'fail', msg: '备件不存在' }
		}
		const beforeStock = Number(part.stock || 0)
		const diff = actualStock - beforeStock
		await transaction.collection('spare_parts').doc(partId).update({
			stock: actualStock,
			updatedAt: Date.now()
		})
		await transaction.collection('spare_part_logs').add({
			enterpriseId: event.enterpriseId,
			partId: partId,
			partName: part.name,
			type: 'adjust',
			qty: diff,
			beforeStock: beforeStock,
			afterStock: actualStock,
			unitPrice: Number(part.costPrice || 0),
			orderId: '',
			carId: '',
			operatorId: event.userId || '',
			operatorName: event.operatorName || '',
			remark: event.remark || '盘点调整',
			createdAt: Date.now()
		})
		await transaction.commit()
	} catch (e) {
		await transaction.rollback()
		return { code: -1, status: 'fail', msg: e.message || '盘点失败' }
	}
	const res = await db.collection('spare_parts').doc(partId).get()
	return { code: 200, status: 'success', data: (res.data || [])[0] || {} }
}
