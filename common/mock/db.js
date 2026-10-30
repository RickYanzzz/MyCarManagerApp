/**
 * 本地 mock 数据库
 * 仅用于 H5 本地调试：用 uni.setStorageSync 模拟 uniCloud 数据库。
 * 生产环境不会走到这里（common/api/index.js 按 NODE_ENV 切换）。
 */
const STORAGE_KEY = 'SMART_CAR_MOCK_DB_V1'

function ts(daysAgo = 0, hoursAgo = 0) {
	return Date.now() - daysAgo * 24 * 60 * 60 * 1000 - hoursAgo * 60 * 60 * 1000
}

function makeId(prefix) {
	return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function seedDb() {
	const now = Date.now()
	const parts = [
		{ code: 'SP0001', name: '机油滤清器', spec: 'JX-001', unit: '个', stock: 24, safetyStock: 10, location: 'A-01', supplier: '博世', costPrice: 8, salePrice: 25 },
		{ code: 'SP0002', name: '空气滤清器', spec: 'KX-202', unit: '个', stock: 18, safetyStock: 8, location: 'A-02', supplier: '曼牌', costPrice: 12, salePrice: 35 },
		{ code: 'SP0003', name: '空调滤芯', spec: 'KT-305', unit: '个', stock: 6, safetyStock: 8, location: 'A-03', supplier: '曼牌', costPrice: 15, salePrice: 45 },
		{ code: 'SP0004', name: '刹车片（前）', spec: 'BP-118', unit: '套', stock: 4, safetyStock: 6, location: 'B-01', supplier: '布雷博', costPrice: 120, salePrice: 280 },
		{ code: 'SP0005', name: '火花塞', spec: 'SP-016', unit: '个', stock: 32, safetyStock: 12, location: 'B-02', supplier: 'NGK', costPrice: 18, salePrice: 50 },
		{ code: 'SP0006', name: '雨刮片', spec: 'WG-260', unit: '对', stock: 9, safetyStock: 5, location: 'C-01', supplier: '博世', costPrice: 25, salePrice: 68 },
		{ code: 'SP0007', name: '防冻液', spec: '4L', unit: '桶', stock: 11, safetyStock: 4, location: 'C-02', supplier: '壳牌', costPrice: 30, salePrice: 80 },
		{ code: 'SP0008', name: '变速箱油', spec: '1L', unit: '瓶', stock: 7, safetyStock: 4, location: 'C-03', supplier: '采埃孚', costPrice: 45, salePrice: 110 },
		{ code: 'SP0009', name: '轮胎', spec: '205/55R16', unit: '条', stock: 3, safetyStock: 4, location: 'D-01', supplier: '米其林', costPrice: 280, salePrice: 520 },
		{ code: 'SP0010', name: '电瓶', spec: '60Ah', unit: '个', stock: 2, safetyStock: 2, location: 'D-02', supplier: '瓦尔塔', costPrice: 320, salePrice: 580 }
	]

	const spareParts = parts.map((p, index) => ({
		_id: 'part_demo_' + String(index + 1).padStart(3, '0'),
		enterpriseId: 'ent_demo_0001',
		code: p.code,
		name: p.name,
		spec: p.spec,
		unit: p.unit,
		stock: p.stock,
		safetyStock: p.safetyStock,
		location: p.location,
		supplier: p.supplier,
		costPrice: p.costPrice,
		salePrice: p.salePrice,
		status: 1,
		createdAt: ts(index + 10),
		updatedAt: ts(index + 10)
	}))

	const sparePartLogs = spareParts.map((p, index) => ({
		_id: 'log_demo_' + String(index + 1).padStart(3, '0'),
		enterpriseId: 'ent_demo_0001',
		partId: p._id,
		partName: p.name,
		type: 'in',
		qty: p.stock,
		beforeStock: 0,
		afterStock: p.stock,
		unitPrice: p.costPrice,
		orderId: '',
		carId: '',
		operatorId: 'user_demo_0001',
		operatorName: '管理员',
		remark: '期初入库',
		createdAt: ts(index + 10)
	}))

	return {
		user: [{
			_id: 'user_demo_0001',
			username: '13800000000',
			phoneNumber: '13800000000',
			password: '123456',
			realName: '管理员',
			enterpriseId: 'ent_demo_0001',
			status: 1
		}],
		enterprise: [{
			_id: 'ent_demo_0001',
			name: '示范汽车服务中心',
			address: '请在管理后台修改为真实地址',
			receipt: '示范汽车服务中心',
			phone: '13800000000'
		}],
		car_info: [
			{ _id: 'car_demo_001', userId: 'user_demo_0001', enterpriseId: 'ent_demo_0001', carNumber: '粤A12345', owner: '李雷', ownerphone: '13800001111', carType: '0', brand: '丰田', engineNumber: 'EN001', frame: 'FRAME001', insure: ts(-120), other: '' },
			{ _id: 'car_demo_002', userId: 'user_demo_0001', enterpriseId: 'ent_demo_0001', carNumber: '粤B88888', owner: '韩梅梅', ownerphone: '13800002222', carType: '1', brand: '本田', engineNumber: 'EN002', frame: 'FRAME002', insure: ts(-80), other: '' },
			{ _id: 'car_demo_003', userId: 'user_demo_0001', enterpriseId: 'ent_demo_0001', carNumber: '临牌', owner: '王强', ownerphone: '13800003333', carType: '2', brand: '大众', engineNumber: '', frame: '', insure: null, other: '' }
		],
		goods: [
			{ _id: 'goods_demo_001', enterpriseId: 'ent_demo_0001', name: '标准洗车', fee: 30, hotStatus: true },
			{ _id: 'goods_demo_002', enterpriseId: 'ent_demo_0001', name: '更换机油', fee: 180, hotStatus: true },
			{ _id: 'goods_demo_003', enterpriseId: 'ent_demo_0001', name: '四轮定位', fee: 120, hotStatus: false },
			{ _id: 'goods_demo_004', enterpriseId: 'ent_demo_0001', name: '空调清洗', fee: 180, hotStatus: true }
		],
		order: [
			{ _id: 'order_demo_001', userId: 'user_demo_0001', enterpriseId: 'ent_demo_0001', carInfoId: 'car_demo_001', time: ts(0, 2), status: 0, updateTime: ts(0, 2) },
			{ _id: 'order_demo_002', userId: 'user_demo_0001', enterpriseId: 'ent_demo_0001', carInfoId: 'car_demo_002', time: ts(1), status: 1, updateTime: ts(1) },
			{ _id: 'order_demo_003', userId: 'user_demo_0001', enterpriseId: 'ent_demo_0001', carInfoId: 'car_demo_003', time: ts(0, 3), status: 2, updateTime: ts(0, 1) },
			{ _id: 'order_demo_004', userId: 'user_demo_0001', enterpriseId: 'ent_demo_0001', carInfoId: 'car_demo_001', time: ts(2), status: 2, updateTime: ts(2) }
		],
		purchased_goods: [
			{ _id: 'pg_demo_001', userId: 'user_demo_0001', enterpriseId: 'ent_demo_0001', name: '标准洗车', fee: 30, count: 1, orderId: 'order_demo_001', carId: 'car_demo_001', status: 0, source: 'goods' },
			{ _id: 'pg_demo_002', userId: 'user_demo_0001', enterpriseId: 'ent_demo_0001', name: '更换机油', fee: 180, count: 1, orderId: 'order_demo_001', carId: 'car_demo_001', status: 0, source: 'goods' },
			{ _id: 'pg_demo_003', userId: 'user_demo_0001', enterpriseId: 'ent_demo_0001', name: '标准洗车', fee: 30, count: 1, orderId: 'order_demo_002', carId: 'car_demo_002', status: 0, source: 'goods' },
			{ _id: 'pg_demo_004', userId: 'user_demo_0001', enterpriseId: 'ent_demo_0001', name: '更换机油', fee: 300, count: 1, orderId: 'order_demo_003', carId: 'car_demo_003', status: 0, source: 'goods' }
		],
		pay_infos: [
			{ _id: 'pay_demo_001', userId: 'user_demo_0001', enterpriseId: 'ent_demo_0001', name: '微信', type: 1, fee: 300, orderId: 'order_demo_003', carId: 'car_demo_003' },
			{ _id: 'pay_demo_002', userId: 'user_demo_0001', enterpriseId: 'ent_demo_0001', name: '现金', type: 2, fee: 480, orderId: 'order_demo_004', carId: 'car_demo_001' }
		],
		spare_parts: spareParts,
		spare_part_logs: sparePartLogs,
		__seedTime: now
	}
}

function loadDb() {
	let db = uni.getStorageSync(STORAGE_KEY)
	if (!db || typeof db !== 'object' || !Array.isArray(db.spare_parts)) {
		db = seedDb()
		uni.setStorageSync(STORAGE_KEY, db)
	}
	// 兼容后续新增集合：缺什么补什么
	const seed = seedDb()
	Object.keys(seed).forEach(key => {
		if (typeof seed[key] === 'object' && !Array.isArray(seed[key]) && seed[key] !== null) {
			if (!db[key]) db[key] = seed[key]
		} else if (Array.isArray(seed[key])) {
			if (!Array.isArray(db[key])) db[key] = seed[key]
		}
	})
	return db
}

function saveDb(db) {
	uni.setStorageSync(STORAGE_KEY, db)
	return db
}

function resetMockDb() {
	uni.removeStorageSync(STORAGE_KEY)
	return loadDb()
}

export {
	STORAGE_KEY,
	seedDb,
	loadDb,
	saveDb,
	resetMockDb,
	makeId
}
