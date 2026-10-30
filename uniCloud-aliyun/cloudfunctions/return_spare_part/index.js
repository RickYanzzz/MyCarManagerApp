'use strict';
const db = uniCloud.database()
const dbCmd = db.command

exports.main = async (event, context) => {
	const id = event.id || event._id
	const qty = parseInt(event.qty || 0)
	if (!id || qty <= 0) {
		return { code: -1, status: 'fail', msg: '退料数量必须大于 0' }
	}

	const transaction = await db.startTransaction()
	try {
		const goodsRes = await transaction.collection('purchased_goods').doc(id).get()
		const goods = (goodsRes.data || [])[0]
		if (!goods) {
			await transaction.rollback()
			return { code: -1, status: 'fail', msg: '备件费用行不存在' }
		}
		if (goods.source !== 'spare_part') {
			await transaction.rollback()
			return { code: -1, status: 'fail', msg: '只有备件费用可以退料' }
		}
		const count = Number(goods.count || 0)
		if (qty > count) {
			await transaction.rollback()
			return { code: -1, status: 'fail', msg: '退料数量不能大于已用数量' }
		}
		const partRes = await transaction.collection('spare_parts').doc(goods.partId).get()
		const part = (partRes.data || [])[0]
		if (!part) {
			await transaction.rollback()
			return { code: -1, status: 'fail', msg: '备件档案不存在' }
		}

		const beforeStock = Number(part.stock || 0)
		await transaction.collection('spare_parts').doc(part._id).update({
			stock: dbCmd.inc(qty),
			updatedAt: Date.now()
		})

		const unitPrice = count > 0 ? Math.round(Number(goods.fee || 0) / count) : Number(part.salePrice || 0)
		if (qty === count) {
			await transaction.collection('purchased_goods').doc(id).remove()
		} else {
			await transaction.collection('purchased_goods').doc(id).update({
				count: count - qty,
				fee: Math.max(0, Number(goods.fee || 0) - unitPrice * qty)
			})
		}

		await transaction.collection('spare_part_logs').add({
			enterpriseId: event.enterpriseId,
			partId: part._id,
			partName: part.name,
			type: 'return',
			qty: qty,
			beforeStock: beforeStock,
			afterStock: beforeStock + qty,
			unitPrice: unitPrice,
			orderId: goods.orderId,
			carId: goods.carId,
			operatorId: event.userId || '',
			operatorName: event.operatorName || '',
			remark: event.remark || '退料',
			createdAt: Date.now()
		})
		await transaction.commit()
	} catch (e) {
		await transaction.rollback()
		return { code: -1, status: 'fail', msg: e.message || '退料失败' }
	}

	return { code: 200, status: 'success', data: { id, qty } }
}
