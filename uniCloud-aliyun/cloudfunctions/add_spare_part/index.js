'use strict';
const db = uniCloud.database()

function padCode(num) {
	return 'SP' + String(num).padStart(4, '0')
}

exports.main = async (event, context) => {
	const enterpriseId = event.enterpriseId
	const name = String(event.name || '').trim()
	if (!name) {
		return { code: -1, status: 'fail', msg: '备件名称不能为空' }
	}

	const codeRes = await db.collection('spare_parts').where({ enterpriseId }).field({ code: true }).get()
	let max = 0
	;(codeRes.data || []).forEach(item => {
		const n = parseInt(String(item.code || '').replace(/[^0-9]/g, ''))
		if (!isNaN(n) && n > max) max = n
	})

	const now = Date.now()
	const stock = parseInt(event.stock || 0) || 0
	const part = {
		enterpriseId,
		code: event.code || padCode(max + 1),
		name,
		spec: event.spec || '',
		unit: event.unit || '个',
		stock,
		safetyStock: parseInt(event.safetyStock || 0) || 0,
		location: event.location || '',
		supplier: event.supplier || '',
		costPrice: parseInt(event.costPrice || 0) || 0,
		salePrice: parseInt(event.salePrice || 0) || 0,
		status: event.status === undefined ? 1 : parseInt(event.status),
		createdAt: now,
		updatedAt: now
	}
	const addRes = await db.collection('spare_parts').add(part)
	part._id = addRes.id

	if (stock > 0) {
		await db.collection('spare_part_logs').add({
			enterpriseId,
			partId: part._id,
			partName: name,
			type: 'in',
			qty: stock,
			beforeStock: 0,
			afterStock: stock,
			unitPrice: part.costPrice,
			orderId: '',
			carId: '',
			operatorId: event.userId || '',
			operatorName: event.operatorName || '',
			remark: '新增备件初始库存',
			createdAt: now
		})
	}

	return { code: 200, status: 'success', data: part }
}
