'use strict'

/**
 * 预约排班纯逻辑测试
 * 运行：node tests/appointment-schedule.test.js
 *
 * 覆盖：北京时间跨天边界、档位生成、非整除营业时长、时段定位、
 *       跨档占位、冲突判定（相邻不冲突/取消不占位/不同师傅不冲突）、
 *       草稿校验与时间吸附、空档计算、汇总口径、重叠对检测。
 */

const path = require('path')

const libDir = path.join(__dirname, '..', 'uniCloud-aliyun', 'cloudfunctions', 'appointment_api', 'lib')
const S = require(path.join(libDir, 'schedule.js'))

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

function checkTrue(name, actual) {
  check(name, !!actual, true)
}

/** 北京时间某天 00:00 的毫秒时间戳 */
function bjMidnight(y, m, d) {
  return Date.UTC(y, m - 1, d, 0, 0, 0, 0) - 8 * 3600 * 1000
}

function at(dayStart, h, min) {
  return dayStart + (h * 60 + (min || 0)) * 60 * 1000
}

const DAY = bjMidnight(2026, 11, 1)
const CFG = { slotMinutes: 60, openMinutes: 8 * 60, closeMinutes: 19 * 60, startAlignMinutes: 30 }

console.log('\n[1] 北京时间换算')
check('UTC 03:00 换算为北京 11-01', S.dateKeyOf(Date.UTC(2026, 10, 1, 3, 0, 0)), '2026-11-01')
check('北京 23:59 仍在 11-01', S.dateKeyOf(Date.UTC(2026, 10, 1, 15, 59, 0)), '2026-11-01')
check('北京 00:00 跨到 11-02', S.dateKeyOf(Date.UTC(2026, 10, 1, 16, 0, 0)), '2026-11-02')
check('北京当天 0 点时间戳', S.beijingDayStart(at(DAY, 13, 45)), DAY)
check('日期键解析回 0 点', S.dayStartFromKey('2026-11-01'), DAY)
check('非法日期键返回 NaN', Number.isNaN(S.dayStartFromKey('2026-13')), true)
check('时分格式', S.hhmm(8 * 60), '08:00')
check('日期可读文案', S.dateLabel('2026-11-01'), '2026年11月1日 周日')

console.log('\n[2] 档位生成')
const slots = S.buildSlots(CFG)
check('08:00-19:00 / 60 分钟 = 11 档', slots.length, 11)
check('首档', [slots[0].label, slots[0].endLabel], ['08:00', '09:00'])
check('末档', [slots[10].label, slots[10].endLabel], ['18:00', '19:00'])
const uneven = S.buildSlots({ slotMinutes: 60, openMinutes: 8 * 60, closeMinutes: 19 * 60 + 30 })
check('非整除时最后一档收窄', [uneven.length, uneven[uneven.length - 1].endLabel], [12, '19:30'])
const cfg30 = S.buildSlots({ slotMinutes: 30, openMinutes: 8 * 60, closeMinutes: 19 * 60 })
check('30 分钟档 = 22 档', cfg30.length, 22)

console.log('\n[3] 时段定位与跨档')
check('09:30 落在第 1 档', S.slotIndexOf(at(DAY, 9, 30), CFG), 1)
check('07:30 早于开门', S.slotIndexOf(at(DAY, 7, 30), CFG), -1)
check('19:00 晚于关门', S.slotIndexOf(at(DAY, 19, 0), CFG), -1)
const span90 = S.slotSpanOf({ startTime: at(DAY, 9, 0), duration: 90 }, CFG)
check('09:00 起 90 分钟占 2 格', [span90.startSlot, span90.spanSlots], [1, 2])
const spanTail = S.slotSpanOf({ startTime: at(DAY, 18, 30), duration: 60 }, CFG)
check('18:30 起 60 分钟被营业结束截断为 1 格', [spanTail.startSlot, spanTail.clippedSpan], [10, 1])
check('时长缺省时由起止时间推导', S.resolveDuration({ startTime: at(DAY, 9, 0), endTime: at(DAY, 10, 30) }), 90)
check('时间区间文案', S.timeRangeText({ startTime: at(DAY, 9, 30), duration: 60 }), '09:30-10:30')

console.log('\n[4] 冲突判定')
const baseList = [
  { _id: 'a1', technicianId: 't1', startTime: at(DAY, 9, 0), duration: 60, status: 0 },
  { _id: 'a2', technicianId: 't1', startTime: at(DAY, 14, 0), duration: 120, status: 1 },
  { _id: 'a3', technicianId: 't2', startTime: at(DAY, 9, 0), duration: 60, status: 0 },
  { _id: 'a4', technicianId: 't1', startTime: at(DAY, 11, 0), duration: 60, status: 3 },
  { _id: 'a5', technicianId: 't1', startTime: at(DAY, 16, 0), duration: 60, status: 4 }
]
check('09:30-10:30 与 09:00-10:00 冲突', S.findConflicts(baseList, { technicianId: 't1', startTime: at(DAY, 9, 30), duration: 60 }).map(x => x._id), ['a1'])
check('10:00-11:00 紧邻不冲突', S.findConflicts(baseList, { technicianId: 't1', startTime: at(DAY, 10, 0), duration: 60 }), [])
check('13:00-14:30 与 14:00-16:00 冲突', S.findConflicts(baseList, { technicianId: 't1', startTime: at(DAY, 13, 0), duration: 90 }).map(x => x._id), ['a2'])
check('换师傅不冲突', S.findConflicts(baseList, { technicianId: 't9', startTime: at(DAY, 9, 30), duration: 60 }), [])
check('已取消不占位', S.findConflicts(baseList, { technicianId: 't1', startTime: at(DAY, 11, 30), duration: 30 }), [])
check('未到店不占位', S.findConflicts(baseList, { technicianId: 't1', startTime: at(DAY, 16, 30), duration: 30 }), [])
check('编辑自身不算冲突', S.findConflicts(baseList, { technicianId: 't1', startTime: at(DAY, 9, 0), duration: 60, excludeId: 'a1' }), [])
// 档位 0 = 08:00-09:00，档位 1 = 09:00-10:00
check('档位 0（08:00-09:00）为空闲', S.freeSlots(baseList, 't1', CFG).indexOf(0), 0)
check('档位 1（09:00-10:00）已被占', S.freeSlots(baseList, 't1', CFG).indexOf(1), -1)
check('档位 2（10:00-11:00）可用，取消单不占位', S.freeSlots(baseList, 't1', CFG).indexOf(2), 1)
check('空闲档 14:00-16:00 两格均不可用', S.freeSlots(baseList, 't1', CFG).indexOf(6), -1)
check('重叠对检测：同师傅 09:30 与 09:00 两条', S.detectConflictPairs(baseList.concat([
  { _id: 'a6', technicianId: 't1', startTime: at(DAY, 9, 30), duration: 60, status: 0 }
])).length, 1)

console.log('\n[5] 草稿校验')
const bad = S.validateDraft({}, CFG)
check('空草稿拦截', bad.ok, false)
check('空草稿三类错误', bad.errors.length >= 3, true)
const aligned = S.validateDraft({
  technicianId: 't1', startTime: at(DAY, 9, 35), duration: 60, customerName: '张先生'
}, CFG)
check('9:35 吸附到 9:30 并提示', [aligned.ok, S.dateKeyOf(aligned.normalized.startTime), S.beijingParts(aligned.normalized.startTime).minutesOfDay], [true, '2026-11-01', 570])
check('吸附产生 warning', aligned.warnings.length, 1)
const outside = S.validateDraft({
  technicianId: 't1', startTime: at(DAY, 20, 0), duration: 60, customerName: '张先生'
}, CFG)
// 两条提示：开始时间不在营业时间内 + 结束时间超出关门时间
check('营业时间外仅提示不拦截', [outside.ok, outside.warnings.length], [true, 2])
const byItems = S.validateDraft({
  technicianId: 't1', startTime: at(DAY, 10, 0), customerName: '张先生',
  items: [{ name: '洗车', duration: 30 }, { name: '换油', duration: 60 }]
}, CFG)
check('无时长时按项目累加 90 分钟', byItems.normalized.duration, 90)
check('结束时间 = 开始 + 时长', byItems.normalized.endTime, at(DAY, 11, 30))
const tooLong = S.validateDraft({
  technicianId: 't1', startTime: at(DAY, 8, 0), duration: 1500, customerName: '张先生'
}, CFG)
check('超 24 小时拦截', tooLong.ok, false)
const fullDay = S.validateDraft({
  technicianId: 't1', startTime: at(DAY, 8, 0), duration: 1440, customerName: '张先生'
}, CFG)
check('24 小时以内允许（跨天业务）', fullDay.ok, true)
const overClose = S.validateDraft({
  technicianId: 't1', startTime: at(DAY, 18, 0), duration: 120, customerName: '张先生'
}, CFG)
check('当日超出关门时间给出提示', overClose.warnings.join('|').indexOf('超出营业时间') > -1, true)
const overnight = S.validateDraft({
  technicianId: 't1', startTime: at(DAY, 18, 0), duration: 960, customerName: '张先生'
}, CFG)
check('跨天预约提示次日结束时间', overnight.warnings.join('|').indexOf('次日 10:00') > -1, true)
const onlyVehicle = S.validateDraft({
  technicianId: 't1', startTime: at(DAY, 8, 0), duration: 60, carInfoId: 'car1'
}, CFG)
check('只选车辆也可保存', onlyVehicle.ok, true)

console.log('\n[6] 汇总口径')
const summary = S.summarize([
  { status: 0, duration: 60 },
  { status: 1, duration: 90 },
  { status: 2, duration: 60 },
  { status: 3, duration: 60 },
  { status: 4, duration: 60 }
], { technicianCount: 2, slotMinutes: 60, openMinutes: 480, closeMinutes: 1140 })
check('取消不计入总数', summary.total, 4)
check('各状态计数', [summary.booked, summary.working, summary.done, summary.noShow, summary.cancelled], [1, 1, 1, 1, 1])
check('占用时长仅计待到店与施工中', summary.occupiedMinutes, 150)
check('负荷率 = 150 / (2 × 660)', Math.round(summary.loadRate * 10000) / 10000, 0.1136)
const emptySummary = S.summarize([], { technicianCount: 0 })
check('无师傅时负荷率为 0 不除零', emptySummary.loadRate, 0)

console.log('\n[7] 分组')
const grouped = S.groupByTechnician(baseList)
check('按师傅分组', [grouped.t1.length, grouped.t2.length], [4, 1])

console.log('\n[8] 跨天预约')
const DAY2 = bjMidnight(2026, 11, 2)
const overnight1 = { _id: 'x1', technicianId: 't1', startTime: at(DAY, 18, 0), duration: 960, status: 0 }
check('跨天判定', S.crossesDay(overnight1), true)
check('当天不跨天', S.crossesDay({ startTime: at(DAY, 9, 0), duration: 60 }), false)
check('跨天时间文案', S.timeRangeText(overnight1), '18:00-次日10:00')
check('看板文案在起始日', S.boardTimeText(overnight1, DAY), '18:00-次日10:00')
check('看板文案在次日标出「昨日」', S.boardTimeText(overnight1, DAY2), '昨日 18:00-次日10:00')

const spanStartDay = S.slotSpanOf(overnight1, CFG, DAY)
check('起始日：18:00 占末档 1 格', [spanStartDay.startSlot, spanStartDay.clippedSpan, spanStartDay.endsAfterDay], [10, 1, true])
const spanNextDay = S.slotSpanOf(overnight1, CFG, DAY2)
check('次日：从首档起占 2 格', [spanNextDay.startSlot, spanNextDay.clippedSpan, spanNextDay.startsBeforeDay], [0, 2, true])
check('次日仍可见（不会再整条消失）', spanNextDay.visible, true)
check('跨天总格数按真实时长', spanNextDay.spanSlots, 16)

// 整夜到凌晨、次日开门前结束的单，第二天不应该进表
const nightOnly = { _id: 'x2', technicianId: 't1', startTime: at(DAY, 17, 0), duration: 480, status: 0 }
check('次日凌晨结束、开门前已完成的不占次日', S.slotSpanOf(nightOnly, CFG, DAY2).visible, false)

const sumDay1 = S.summarize([overnight1], { technicianCount: 1, dayStart: DAY, slotMinutes: 60, openMinutes: 480, closeMinutes: 1140 })
const sumDay2 = S.summarize([overnight1], { technicianCount: 1, dayStart: DAY2, slotMinutes: 60, openMinutes: 480, closeMinutes: 1140 })
check('起始日只算 18:00-19:00 的 60 分钟', sumDay1.occupiedMinutes, 60)
check('次日只算 08:00-10:00 的 120 分钟', sumDay2.occupiedMinutes, 120)
check('汇总统计跨天单数', [sumDay1.crossDayCount, sumDay2.crossDayCount], [1, 1])
check('跨天单在次日仍计一单', sumDay2.total, 1)

// 跨天单与次日早上新单的时间冲突（同师傅）
check('跨天单占用次日早上，新单被判冲突', S.findConflicts([overnight1], {
  technicianId: 't1', startTime: at(DAY2, 9, 0), duration: 60
}).map(x => x._id), ['x1'])

console.log('\n[9] 工位容量')
const BAY = Object.assign({}, CFG, { bayCount: 2 })
const bayList = [
  { _id: 'b1', technicianId: 't1', startTime: at(DAY, 9, 0), duration: 60, status: 0, bayNo: 1 },
  { _id: 'b2', technicianId: 't2', startTime: at(DAY, 9, 30), duration: 60, status: 0, bayNo: 2 },
  { _id: 'b3', technicianId: 't3', startTime: at(DAY, 9, 0), duration: 60, status: 3 }
]
const planFull = S.bayPlan(bayList, { startTime: at(DAY, 9, 0), duration: 60 }, BAY)
check('两单占满两个工位', [planFull.usedBays, planFull.freeBays, planFull.full], [[1, 2], [], true])
check('工位满时没有建议工位', planFull.suggestedBay, 0)
check('已取消的单不占工位', planFull.occupiedCount, 2)
const planFree = S.bayPlan(bayList, { startTime: at(DAY, 10, 0), duration: 60 }, BAY)
check('空时段建议用 1 号工位', [planFree.suggestedBay, planFree.full], [1, false])
const planExclude = S.bayPlan(bayList, { startTime: at(DAY, 9, 0), duration: 60, excludeId: 'b2' }, BAY)
check('编辑自身时释放自己占的工位', planExclude.freeBays, [2])
const planUnlimited = S.bayPlan(bayList, { startTime: at(DAY, 9, 0), duration: 60 }, Object.assign({}, CFG, { bayCount: 0 }))
check('bayCount=0 不做工位约束', [planUnlimited.limited, planUnlimited.full], [false, false])

const legacyList = [
  { _id: 'l1', technicianId: 't1', startTime: at(DAY, 9, 0), duration: 60, status: 0, bayNo: 1 },
  { _id: 'l2', technicianId: 't2', startTime: at(DAY, 9, 10), duration: 60, status: 0 }
]
check('历史单没登记工位号时按顺序补空位', S.bayPlan(legacyList, {
  startTime: at(DAY, 9, 0), duration: 60
}, BAY).usedBays, [1, 2])
const legacyAlone = [
  { _id: 'l3', technicianId: 't1', startTime: at(DAY, 10, 0), duration: 60, status: 0 }
]
check('单条历史单默认占 1 号位，建议 2 号位', S.bayPlan(legacyAlone, {
  startTime: at(DAY, 10, 0), duration: 60
}, BAY).suggestedBay, 2)

const load = S.bayLoad([
  { _id: 'k1', startTime: at(DAY, 9, 0), duration: 60, status: 0, bayNo: 1 },
  { _id: 'k2', startTime: at(DAY, 9, 30), duration: 60, status: 0, bayNo: 2 },
  { _id: 'k3', startTime: at(DAY, 9, 0), duration: 60, status: 3, bayNo: 1 }
], BAY, DAY)
check('工位负荷峰值与出现档位', [load.peak, load.peakLabel], [2, '09:00-10:00'])
check('已满档位', load.fullLabels, ['09:00-10:00'])
check('取消单不计入工位负荷', load.load[1], 2)
const loadEmpty = S.bayLoad([], BAY, DAY)
check('无预约时峰值为 0', [loadEmpty.peak, loadEmpty.fullSlots.length], [0, 0])

check('同工位重叠可被检出', S.detectBayConflictPairs([
  { _id: 's1', startTime: at(DAY, 9, 0), duration: 60, status: 0, bayNo: 1 },
  { _id: 's2', startTime: at(DAY, 9, 30), duration: 60, status: 0, bayNo: 1 }
]).length, 1)

console.log('\n----------------------------------------')
console.log('通过 ' + passed + ' 项，失败 ' + failed + ' 项')
if (failed) {
  failures.forEach(f => console.log('\n失败：' + f))
  process.exit(1)
}
