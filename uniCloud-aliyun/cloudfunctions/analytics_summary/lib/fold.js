'use strict'

/**
 * 聚合结果折叠逻辑（纯函数，无 uniCloud 依赖，可单独在 Node 下测试）
 *
 * 输入是两条聚合管道的输出，输出是页面直接可用的结构。
 *
 * 口径约定（与首页“今日收入”保持一致）：
 * 1. 只统计 status = 2（已入账）的订单，且订单 updateTime 落在区间内。
 * 2. 金额 = 该订单下所有 pay_infos.fee 之和，但 type = 4（赠送）不计入。
 * 3. 工单数来自订单表本身，不受“有无付款记录”“一单几笔付款”影响。
 */

const { dateOfDayIndex } = require('./day-bucket.js')

const GIFT_TYPE = 4

const PAY_TYPE_LABELS = {
  1: '微信',
  2: '现金',
  3: '支付宝',
  4: '赠送',
  5: '其他',
  6: '银行卡'
}

/** 数据库里 fee 历史数据可能是字符串，统一转数字，非法值按 0 处理 */
function toNumber(value) {
  const n = Number(value)
  return isFinite(n) ? n : 0
}

function round2(value) {
  return Math.round(toNumber(value) * 100) / 100
}

function labelOfType(type) {
  return PAY_TYPE_LABELS[type] || ('未知类型(' + type + ')')
}

/**
 * @param {Array} orderRows  来自 order 聚合：[{ _id: 日索引, orders: 工单数 }]
 * @param {Array} payRows    来自 pay_infos 聚合：[{ _id: { day: 日索引, type: 支付类型 }, fees: [金额...] }]
 * @param {Object} rangeInfo { firstIdx: 起始日索引, days: 天数 }
 */
function buildResult(orderRows, payRows, rangeInfo) {
  const firstIdx = Number(rangeInfo.firstIdx)
  const days = Number(rangeInfo.days)

  // 日索引 -> { amount, orders }
  const dailyMap = {}
  // 支付类型 -> { type, label, amount, count }
  const typeMap = {}
  let giftAmount = 0

  // ---- 1. 先处理付款记录（金额 + 支付方式）----
  const payList = payRows || []
  for (let i = 0; i < payList.length; i++) {
    const row = payList[i] || {}
    const idObj = row._id || {}
    const day = toNumber(idObj.day)
    const type = toNumber(idObj.type)
    const fees = row.fees || []

    let amount = 0
    for (let j = 0; j < fees.length; j++) {
      amount += toNumber(fees[j])
    }

    if (!typeMap[type]) {
      typeMap[type] = { type: type, label: labelOfType(type), amount: 0, count: 0 }
    }
    typeMap[type].count += fees.length
    // 先记到自己那一项（赠送也要能在明细里看到自己的金额）
    typeMap[type].amount += amount

    if (type === GIFT_TYPE) {
      // 赠送金额单独统计，不计入已入账金额，也不进入每日金额
      giftAmount += amount
      continue
    }

    if (!dailyMap[day]) {
      dailyMap[day] = { amount: 0, orders: 0 }
    }
    dailyMap[day].amount += amount
  }

  // ---- 2. 再处理订单（工单数），保证无付款记录的订单也计入 ----
  const orderList = orderRows || []
  for (let i = 0; i < orderList.length; i++) {
    const row = orderList[i] || {}
    const day = toNumber(row._id)
    if (!dailyMap[day]) {
      dailyMap[day] = { amount: 0, orders: 0 }
    }
    dailyMap[day].orders += toNumber(row.orders)
  }

  // ---- 3. 补齐区间内每一天（无数据日期补 0，跨月跨年由日索引天然处理）----
  const daily = []
  let totalAmount = 0
  let totalOrders = 0
  for (let k = 0; k < days; k++) {
    const idx = firstIdx + k
    const cell = dailyMap[idx] || { amount: 0, orders: 0 }
    daily.push({
      date: dateOfDayIndex(idx),
      amount: round2(cell.amount),
      orders: cell.orders
    })
    totalAmount += cell.amount
    totalOrders += cell.orders
  }

  // ---- 4. 支付方式分布（赠送不进分母，单独给 giftAmount）----
  const payTypes = []
  for (const key in typeMap) {
    if (!Object.prototype.hasOwnProperty.call(typeMap, key)) continue
    const t = typeMap[key]
    payTypes.push({
      type: t.type,
      label: t.label,
      amount: round2(t.amount),
      count: t.count,
      isGift: t.type === GIFT_TYPE
    })
  }
  payTypes.sort(function (a, b) {
    if (b.amount !== a.amount) return b.amount - a.amount
    return a.type - b.type
  })

  return {
    summary: {
      totalAmount: round2(totalAmount),
      totalOrders: totalOrders,
      avgPerOrder: totalOrders > 0 ? round2(totalAmount / totalOrders) : 0,
      giftAmount: round2(giftAmount),
      payTypeCount: payTypes.length
    },
    daily: daily,
    payTypes: payTypes
  }
}

module.exports = {
  GIFT_TYPE: GIFT_TYPE,
  PAY_TYPE_LABELS: PAY_TYPE_LABELS,
  buildResult: buildResult,
  round2: round2,
  toNumber: toNumber
}
