'use strict';
const db = uniCloud.database()

exports.main = async (event, context) => {
	const enterpriseId = event.enterpriseId
	const keyword = String(event.keyword || '').trim().toLowerCase()
	const lowStockOnly = event.lowStockOnly === true || event.lowStockOnly === 'true'
	const includeDisabled = event.includeDisabled === true || event.includeDisabled === 'true'

	const res = await db.collection('spare_parts').where({ enterpriseId }).get()
	let list = res.data || []
	if (!includeDisabled) {
		list = list.filter(item => Number(item.status) === 1)
	}
	if (keyword) {
		list = list.filter(item => {
			const text = [item.code, item.name, item.spec, item.supplier].join(' ').toLowerCase()
			return text.indexOf(keyword) > -1
		})
	}
	if (lowStockOnly) {
		list = list.filter(item => Number(item.stock || 0) <= Number(item.safetyStock || 0))
	}
	list.sort((a, b) => {
		const aLow = Number(a.stock || 0) <= Number(a.safetyStock || 0) ? 1 : 0
		const bLow = Number(b.stock || 0) <= Number(b.safetyStock || 0) ? 1 : 0
		if (aLow !== bLow) return bLow - aLow
		return String(a.code || '').localeCompare(String(b.code || ''))
	})

	return { code: 200, status: 'success', data: list }
}
