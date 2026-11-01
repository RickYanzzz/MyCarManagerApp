'use strict'

/**
 * 预约排班接线检查
 * 运行：node tests/appointment-wiring.test.js
 *
 * 语法检查抓不到「名字对不上」这类问题：页面调用了 $api 里不存在的方法、
 * 新页面忘了注册到 pages.json、跳转路径写错。这里用静态扫描兜住这些。
 */

const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')

let passed = 0
let failed = 0
const failures = []

function check(name, ok, detail) {
  if (ok) {
    passed++
    console.log('  PASS  ' + name)
  } else {
    failed++
    failures.push(name + (detail ? '\n        ' + detail : ''))
    console.log('  FAIL  ' + name + (detail ? '  ' + detail : ''))
  }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel))
}

/* ---------------- pages.json ---------------- */

const pagesRaw = read('pages.json').replace(/\/\/[^\n]*/g, '')
let pagesJson = null
try {
  pagesJson = JSON.parse(pagesRaw)
} catch (e) {
  check('pages.json 可解析', false, e.message)
}
check('pages.json 可解析', !!pagesJson)

const registered = ((pagesJson && pagesJson.pages) || []).map(p => p.path)
;['pages/appointment/board', 'pages/appointment/edit', 'pages/appointment/detail'].forEach(p => {
  check('已注册 ' + p, registered.indexOf(p) > -1)
  check('页面文件存在 ' + p, exists(p + '.vue'))
})

/* ---------------- API 名称 ---------------- */

const apiIndex = read('common/api/index.js')
const realApiBlock = (apiIndex.match(/const realApi = \{([\s\S]*?)\n\}/) || [])[1] || ''
const realApiNames = realApiBlock
  .split(',')
  .map(s => s.trim())
  .filter(s => /^[a-zA-Z_$][\w$]*$/.test(s))

;['get_appointment_board', 'get_appointment_detail', 'get_appointment_by_member', 'save_appointment', 'set_appointment_status', 'appointment_to_order', 'set_technician']
	.forEach(name => {
		check('realApi 已注册 ' + name, realApiNames.indexOf(name) > -1)
	})

const mockSource = read('common/mock/api.js')
;['get_appointment_board', 'get_appointment_detail', 'save_appointment', 'set_appointment_status', 'appointment_to_order', 'set_technician']
	.forEach(name => {
		const declared = new RegExp('function\\s+' + name + '\\s*\\(').test(mockSource)
		const exported = new RegExp('\\r?\\n\\t' + name + ',?\\r?\\n').test(mockSource)
		check('mock 已实现 ' + name, declared)
		check('mock 已导出 ' + name, exported)
	})

/* ---------------- 页面里的 $api 调用 ---------------- */

const adminApis = realApiNames
const pageFiles = ['pages/appointment/board.vue', 'pages/appointment/edit.vue', 'pages/appointment/detail.vue', 'pages/member/detail.vue']

pageFiles.forEach(file => {
  const src = read(file)
  const calls = []
  const re = /\$api\.([a-zA-Z_$][\w$]*)/g
  let m
  while ((m = re.exec(src)) !== null) {
    if (calls.indexOf(m[1]) < 0) calls.push(m[1])
  }
  calls.forEach(name => {
    check(file + ' 调用的 ' + name + ' 存在', adminApis.indexOf(name) > -1)
  })
})

/* ---------------- 跳转路径 ---------------- */

const boardSrc = read('pages/appointment/board.vue')
check('看板跳转到预约登记页', boardSrc.indexOf('/pages/appointment/edit') > -1)
check('看板跳转到预约详情页', boardSrc.indexOf('/pages/appointment/detail') > -1)

const detailSrc = read('pages/appointment/detail.vue')
const billingUrl = '/pages/index/billing/billingDetail/billingDetail'
check('详情页跳转到开单页', detailSrc.indexOf(billingUrl) > -1)
check('开单页文件存在', exists('pages/index/billing/billingDetail/billingDetail.vue'))

const editSrc = read('pages/appointment/edit.vue')
check('登记页支持通过 id 进入编辑', /opt\.id|options\.id/.test(editSrc) && editSrc.indexOf('loadDetail') > -1)

/* ---------------- 首页入口 ---------------- */

;['pages/index/index.vue', 'pages/home/home.vue'].forEach(file => {
  check(file + ' 有预约排班入口', read(file).indexOf('/pages/appointment/board') > -1)
})

/* ---------------- 数据库与云函数 ---------------- */

check('appointment schema 存在', exists('uniCloud-aliyun/database/appointment.schema.json'))
check('appointment_api 云函数存在', exists('uniCloud-aliyun/cloudfunctions/appointment_api/index.js'))
check('云函数 package.json 存在', exists('uniCloud-aliyun/cloudfunctions/appointment_api/package.json'))

const schema = JSON.parse(read('uniCloud-aliyun/database/appointment.schema.json'))
check('schema 关闭了客户端直读权限', schema.permission && schema.permission.read === false)
check('schema 声明了师傅外键', schema.properties.technicianId.foreignKey === 'user._id')
check('schema 声明了开始时间', schema.properties.startTime.bsonType === 'timestamp')

const fnSrc = read('uniCloud-aliyun/cloudfunctions/appointment_api/index.js')
;['board', 'detail', 'byMember', 'save', 'status', 'toOrder', 'setTechnician'].forEach(action => {
  check('云函数已挂载 action ' + action, new RegExp(action + ':\\s*action').test(fnSrc))
})
check('云函数不采信客户端 enterpriseId', fnSrc.indexOf('auth.enterpriseId') > -1)
check('一键开单会写消费项目', fnSrc.indexOf('COLL.purchased') > -1)
check('已开单的预约不允许改时间', fnSrc.indexOf('已开单，改时间请先在工单中处理') > -1)

/* ---------------- 跨天预约 ---------------- */

check('schema 声明了工位号', schema.properties.bayNo && schema.properties.bayNo.bsonType === 'int')
check('看板按时间区间取数（含前一天）', fnSrc.indexOf('dayStart - S.DAY_MS') > -1)
check('看板用 overlapsDay 二次过滤', fnSrc.indexOf('overlapsDay(') > -1)
check('看板输出 boardTimeText', fnSrc.indexOf('S.boardTimeText') > -1)
check('看板标记跨天单', fnSrc.indexOf('startsBeforeDay') > -1 && fnSrc.indexOf('crossDay:') > -1)
check('看板页面显示「续」标记', boardSrc.indexOf('startsBeforeDay') > -1 && boardSrc.indexOf('block-tag') > -1)
check('看板清单显示跨天时间', boardSrc.indexOf('a.boardTimeText') > -1)
check('详情页展示跨天', detailSrc.indexOf('crossDay') > -1)

/* ---------------- 工位容量 ---------------- */

check('云函数保存时校验工位', fnSrc.indexOf('S.bayPlan') > -1)
check('工位满时返回 409 且带 bayFull', fnSrc.indexOf('bayFull') > -1 && fnSrc.indexOf('工位都已占用') > -1)
check('云函数写入 bayNo', /bayNo:\s*bayNo/.test(fnSrc))
check('看板统计工位负荷', fnSrc.indexOf('S.bayLoad') > -1)
check('看板页面展示工位占用', boardSrc.indexOf('bayText') > -1)
check('登记页可选工位', editSrc.indexOf('bayPlan') > -1 && editSrc.indexOf('pickBay') > -1)
check('登记页提交 bayNo', /bayNo:\s*this\.form\.bayNo/.test(editSrc))
check('详情页展示工位', detailSrc.indexOf('bayText') > -1)

const utilSrc = read('common/utils/schedule.js')
// bayLoad 只在服务端算好下发，前端不复刻，避免两套峰位算法漂移
;['bayPlan', 'endLabelOf', 'crossesDay'].forEach(name => {
  check('前端工具导出 ' + name, new RegExp('export function ' + name + '\\s*\\(').test(utilSrc))
})
check('mock 实现工位校验', mockSource.indexOf('S.bayPlan') > -1)
check('mock 计算工位负荷', mockSource.indexOf('function apptBayLoad') > -1)

console.log('\n----------------------------------------')
console.log('通过 ' + passed + ' 项，失败 ' + failed + ' 项')
if (failed) {
  failures.forEach(f => console.log('\n失败：' + f))
  process.exit(1)
}
