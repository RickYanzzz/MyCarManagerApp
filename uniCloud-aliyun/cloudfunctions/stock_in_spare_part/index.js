'use strict';
const db = uniCloud.database()
const dbCmd = db.command

exports.main = async (event, context) => {
	const partId = event.partId
	const qty = parseInt(event.qty || 0)
	if (!partId || qty <= 0) {
		return { code: -1, status: 'fail', msg: '入库数量必须大于 0' }
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
		const updateData = { stock: dbCmd.inc(qty), updatedAt: Date.now() }
		if (event.unitCost !== undefined && event.unitCost !== '') updateData.costPrice = parseInt(event.unitCost)
		if (event.supplier) updateData.supplier = event.supplier
		await transaction.collection('spare_parts').doc(partId).update(updateData)
		await transaction.collection('spare_part_logs').add({
			enterpriseId: event.enterpriseId,
			partId: partId,
			partName: part.name,
			type: 'in',
			qty: qty,
			beforeStock: beforeStock,
			afterStock: beforeStock + qty,
			unitPrice: event.unitCost !== undefined && event.unitCost !== '' ? parseInt(event.unitCost) : Number(part.costPrice || 0),
			orderId: '',
			carId: '',
			operatorId: event.userId || '',
			operatorName: event.operatorName || '',
			remark: event.remark || '',
			createdAt: Date.now()
		})
		await transaction.commit()
	} catch (e) {
		await transaction.rollback()
		return { code: -1, status: 'fail', msg: e.message || '入库失败' }
	}
	const res = await db.collection('spare_parts').doc(partId).get()
	return { code: 200, status: 'success', data: (res.data || [])[0] || {} }
}
