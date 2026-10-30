'use strict'

/**
 * analytics_summary 统计口径测试
 *
 * 直接复用云函数里的纯逻辑模块（无 uniCloud 依赖），
 * 用 node 运行：node tests/analytics-summary.test.js
 *
 * 覆盖：跨月/跨年、北京时间边界、空数据补零、无付款订单、
 *       一单多笔不重复计工单、赠送剔除、字符串金额容错、除零保护。
 */

const path = require('path')

const libDir = path.join(__dirname, '..', 'uniCloud-aliyun', 'cloudfunctions', 'analytics_summary', 'lib')
const { dayIndexOf, resolveRange, dateOfDayIndex } = require(path.join(libDir, 'day-bucket.js'))
const { buildResult } = require(path.join(libDir, 'fold.js'))

let passed = 0
let failed = 0
const failures = []

function check(name, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    passed++
    console.log('  PASS  ' + name)
  } else {
    failed++
    failures.push(name + '\n        期望: ' + e + '\n        实际: ' + a)
    console.log('  FAIL  ' + name + '  期望 ' + e + ' 实际 ' + a)
  }
}

/** 构造北京时间某天 00:00 的毫秒时间戳 */
function beijingMidnight(y, m, d) {
  return Date.UTC(y, m - 1, d, 0, 0, 0, 0) - 8 * 3600 * 1000
}

/* ==================== 1. 日期与区间 ==================== */
console.log('\n[1] 北京时间自然日区间')

const now1 = Date.UTC(2026, 9, 28, 12, 0, 0) // 2026-10-28 20:00 北京
const r7 = resolveRange(7, now1)
check('r7.days', r7.days, 7)
check('r7.startDate', r7.startDate, '2026-10-22')
check('r7.endDate', r7.endDate, '2026-10-28')
check('r7.startTime 为零点', r7.startTime, beijingMidnight(2026, 10, 22))
check('r7.endTime 为明天零点(左闭右开)', r7.endTime, beijingMidnight(2026, 10, 29))

const r30 = resolveRange(30, now1)
check('r30.startDate', r30.startDate, '2026-09-29')
check('r30 天数', r30.days, 30)

const r90 = resolveRange(90, now1)
check('r90.startDate', r90.startDate, '2026-07-31')

console.log('\n[2] 跨年 / 跨月')
const nowNY = Date.UTC(2027, 0, 2, 2, 0, 0) // 2027-01-02 10:00 北京
const r7ny = resolveRange(7, nowNY)
check('跨年 startDate', r7ny.startDate, '2026-12-27')
check('跨年 endDate', r7ny.endDate, '2027-01-02')

const r30ny = resolveRange(30, nowNY)
check('跨年 30 天 startDate', r30ny.startDate, '2026-12-04')

console.log('\n[3] 北京日分桶边界')
const midnight = beijingMidnight(2026, 10, 28)
check('00:00:00 归当天', dateOfDayIndex(dayIndexOf(midnight)), '2026-10-28')
check('前一天 23:59:59.999 归前一天', dateOfDayIndex(dayIndexOf(midnight - 1)), '2026-10-27')
check('当天 23:59:59.999 仍归当天', dateOfDayIndex(dayIndexOf(midnight + 86400000 - 1)), '2026-10-28')

/* ==================== 2. 折叠口径 ==================== */
console.log('\n[4] 基本金额与工单')

const firstIdx = dayIndexOf(beijingMidnight(2026, 10, 26))
const rangeInfo = { firstIdx: firstIdx, days: 3 }

// 10-26: 2 单, 微信 300 + 现金 200 ；10-27: 1 单, 支付宝 150 ；10-28: 无数据
const orderRows = [
  { _id: firstIdx, orders: 2 },
  { _id: firstIdx + 1, orders: 1 }
]
const payRows = [
  { _id: { day: firstIdx, type: 1 }, fees: [300] },
  { _id: { day: firstIdx, type: 2 }, fees: [200] },
  { _id: { day: firstIdx + 1, type: 3 }, fees: [150] }
]
let res = buildResult(orderRows, payRows, rangeInfo)

check('daily 长度', res.daily.length, 3)
check('日期序列', res.daily.map(function (d) { return d.date }), ['2026-10-26', '2026-10-27', '2026-10-28'])
check('每天金额', res.daily.map(function (d) { return d.amount }), [500, 150, 0])
check('每天工单', res.daily.map(function (d) { return d.orders }), [2, 1, 0])
check('总额', res.summary.totalAmount, 650)
check('总单数', res.summary.totalOrders, 3)
check('平均每单', res.summary.avgPerOrder, 216.67)
check('收款方式数', res.summary.payTypeCount, 3)
check('收款方式排序(金额降序)', res.payTypes.map(function (t) { return t.label }), ['微信', '现金', '支付宝'])

console.log('\n[5] 无付款记录的已入账订单')
res = buildResult([{ _id: firstIdx, orders: 1 }], [], rangeInfo)
check('工单仍计数', res.summary.totalOrders, 1)
check('金额为 0', res.summary.totalAmount, 0)
check('平均每单为 0', res.summary.avgPerOrder, 0)
check('该日金额 0 工单 1', { a: res.daily[0].amount, o: res.daily[0].orders }, { a: 0, o: 1 })

console.log('\n[6] 一单多笔付款不重复计工单')
// 同一天 3 条付款记录，但订单聚合只报了 1 单
res = buildResult(
  [{ _id: firstIdx, orders: 1 }],
  [
    { _id: { day: firstIdx, type: 1 }, fees: [100] },
    { _id: { day: firstIdx, type: 2 }, fees: [50] },
    { _id: { day: firstIdx, type: 6 }, fees: [30] }
  ],
  rangeInfo
)
check('工单数仍为 1', res.summary.totalOrders, 1)
check('金额累加为 180', res.summary.totalAmount, 180)
check('平均每单 180', res.summary.avgPerOrder, 180)

console.log('\n[7] 赠送金额剔除')
res = buildResult(
  [{ _id: firstIdx, orders: 2 }],
  [
    { _id: { day: firstIdx, type: 1 }, fees: [400] },
    { _id: { day: firstIdx, type: 4 }, fees: [260] }
  ],
  rangeInfo
)
check('赠送不计入总额', res.summary.totalAmount, 400)
check('赠送单独统计', res.summary.giftAmount, 260)
check('当日金额不含赠送', res.daily[0].amount, 400)
const giftItem = res.payTypes.filter(function (t) { return t.isGift })[0]
check('赠送项存在且标记 isGift', !!giftItem, true)
check('赠送金额', giftItem.amount, 260)
check('非赠送项金额 400', res.payTypes.filter(function (t) { return !t.isGift })[0].amount, 400)

console.log('\n[8] 金额字符串容错')
res = buildResult(
  [{ _id: firstIdx, orders: 1 }],
  [{ _id: { day: firstIdx, type: 2 }, fees: ['100', '50.5', null, 'abc'] }],
  rangeInfo
)
check('字符串金额安全求和', res.summary.totalAmount, 150.5)

console.log('\n[9] 空数据')
res = buildResult([], [], rangeInfo)
check('每日补零', res.daily.map(function (d) { return d.amount }), [0, 0, 0])
check('无工单', res.summary.totalOrders, 0)
check('平均每单除零保护', res.summary.avgPerOrder, 0)
check('收款方式为空', res.payTypes.length, 0)

console.log('\n[10] 30 天跨月补零')
const r30info = { firstIdx: resolveRange(30, Date.UTC(2026, 10, 1, 4, 0, 0)).firstIdx, days: 30 }
res = buildResult([], [], r30info)
check('daily 长度 30', res.daily.length, 30)
check('首日', res.daily[0].date, '2026-10-03')
check('末日', res.daily[29].date, '2026-11-01')
check('首尾均补 0', [res.daily[0].amount, res.daily[29].amount], [0, 0])

/* ==================== 汇总 ==================== */
console.log('\n====================================')
console.log('通过 ' + passed + ' / ' + (passed + failed))
if (failed > 0) {
  console.log('\n失败明细：')
  failures.forEach(function (f) { console.log(' - ' + f) })
  process.exit(1)
} else {
  console.log('全部通过')
}
