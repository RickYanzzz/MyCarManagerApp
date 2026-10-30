'use strict'

/**
 * 北京时间自然日分桶工具（纯函数，无 uniCloud 依赖，可单独在 Node 下测试）
 *
 * 背景：
 * - order.updateTime 存的是毫秒时间戳（number），不是 Date 类型。
 * - 阿里云 MongoDB 默认按 UTC 处理，直接按 86400000 整除会得到 UTC 日，
 *   与门店实际看到的“北京时间当天”差 8 小时，凌晨 0~8 点的单会归错日期。
 * - 所以统一先把时间戳加 8 小时偏移，再除以一天，得到“北京日索引”。
 */

const DAY_MS = 24 * 60 * 60 * 1000
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000

/** 毫秒时间戳 -> 北京日索引（自 1970-01-01 起的天数） */
function dayIndexOf(ms) {
  return Math.floor((Number(ms) + BEIJING_OFFSET_MS) / DAY_MS)
}

function pad2(n) {
  return n < 10 ? '0' + n : '' + n
}

/**
 * 北京日索引 -> 'YYYY-MM-DD'
 * 因为索引已经加过 8 小时偏移，这里必须用 getUTC* 系列读取，不能再走本地时区。
 */
function dateOfDayIndex(dayIndex) {
  const d = new Date(dayIndex * DAY_MS)
  return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate())
}

/**
 * 计算统计区间：左闭右开，按北京时间自然日对齐。
 * range = 7 表示“含今天在内的最近 7 天”。
 *
 * 返回的 startTime / endTime 是毫秒时间戳，可直接用于 updateTime 区间比较。
 */
function resolveRange(range, nowMs) {
  const days = Number(range)
  const now = typeof nowMs === 'number' ? nowMs : Date.now()
  const todayIdx = dayIndexOf(now)

  // 下界：range 天前的 00:00（北京）
  // 上界：明天 00:00（北京），右开区间，不包含明天
  const firstIdx = todayIdx + 1 - days
  const startTime = firstIdx * DAY_MS - BEIJING_OFFSET_MS
  const endTime = (todayIdx + 1) * DAY_MS - BEIJING_OFFSET_MS

  return {
    days: days,
    todayIdx: todayIdx,
    firstIdx: firstIdx,
    startTime: startTime,
    endTime: endTime,
    startDate: dateOfDayIndex(firstIdx),
    endDate: dateOfDayIndex(todayIdx)
  }
}

module.exports = {
  DAY_MS: DAY_MS,
  BEIJING_OFFSET_MS: BEIJING_OFFSET_MS,
  dayIndexOf: dayIndexOf,
  dateOfDayIndex: dateOfDayIndex,
  resolveRange: resolveRange
}
