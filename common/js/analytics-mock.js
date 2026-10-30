/**
 * 经营统计本地模拟数据（仅用于云函数未部署时的页面联调）
 *
 * 目的：在没有可信认证、云函数不允许部署到共享空间的前提下，
 * 让页面能完整跑起来、看到真实布局与交互，同时保证**不接触任何门店真实数据**。
 *
 * 数据由固定种子生成，同样参数多次刷新结果一致，便于截图比对与回归。
 */

const DAY_MS = 24 * 60 * 60 * 1000
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000

function pad2(n) {
  return n < 10 ? '0' + n : '' + n
}

function dayIndexOf(ms) {
  return Math.floor((Number(ms) + BEIJING_OFFSET_MS) / DAY_MS)
}

function dateOfDayIndex(dayIndex) {
  const d = new Date(dayIndex * DAY_MS)
  return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate())
}

// 线性同余伪随机，保证可复现
function createRandom(seed) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return function () {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function round2(v) {
  return Math.round(v * 100) / 100
}

// 与 components/pay-view 中的枚举保持一致：1微信 2现金 3支付宝 4赠送 5其他 6银行卡
const PAY_TYPE_DEFS = [
  { type: 1, label: '微信' },
  { type: 2, label: '现金' },
  { type: 3, label: '支付宝' },
  { type: 6, label: '银行卡' },
  { type: 5, label: '其他' }
]

export function buildMockAnalytics(range, nowMs) {
  const days = Number(range) || 7
  const now = typeof nowMs === 'number' ? nowMs : Date.now()
  const todayIdx = dayIndexOf(now)
  const firstIdx = todayIdx + 1 - days

  const daily = []
  let totalAmount = 0
  let totalOrders = 0

  for (let i = 0; i < days; i++) {
    const idx = firstIdx + i
    // 用日索引做种子，保证同一天的数字稳定
    const seeded = createRandom((idx + 1048576) * 31 + 7)
    const weekday = new Date(idx * DAY_MS).getUTCDay()
    const isWeekend = weekday === 0 || weekday === 6

    // 约 12% 的日子没生意，用来验证空数据日期的补零
    const closed = seeded() < 0.12
    const base = isWeekend ? 1500 : 2600
    const orders = closed ? 0 : Math.max(1, Math.round(base / 480 + (seeded() - 0.5) * 4))
    const avg = 380 + seeded() * 260
    const amount = closed ? 0 : round2(orders * avg)

    daily.push({ date: dateOfDayIndex(idx), amount: amount, orders: orders })
    totalAmount += amount
    totalOrders += orders
  }

  // 收款方式分布（合计与 totalAmount 对齐）
  const weights = [0.52, 0.18, 0.16, 0.09, 0.05]
  const payTypes = PAY_TYPE_DEFS.map(function (def, i) {
    return {
      type: def.type,
      label: def.label,
      amount: round2(totalAmount * weights[i]),
      count: Math.max(0, Math.round(totalOrders * weights[i])),
      isGift: false
    }
  }).filter(function (t) {
    return t.amount > 0
  })

  // 修正四舍五入误差，让占比合计恰好 100%
  if (payTypes.length > 0) {
    const sum = payTypes.reduce(function (acc, t) {
      return acc + t.amount
    }, 0)
    payTypes[0].amount = round2(payTypes[0].amount + (totalAmount - sum))
  }

  payTypes.sort(function (a, b) {
    return b.amount - a.amount
  })

  return {
    code: 200,
    status: 'success',
    data: {
      range: days,
      startDate: dateOfDayIndex(firstIdx),
      endDate: dateOfDayIndex(todayIdx),
      generatedAt: Date.now(),
      costMs: 0,
      mock: true,
      summary: {
        totalAmount: round2(totalAmount),
        totalOrders: totalOrders,
        avgPerOrder: totalOrders > 0 ? round2(totalAmount / totalOrders) : 0,
        giftAmount: round2(totalAmount * 0.03),
        payTypeCount: payTypes.length
      },
      daily: daily,
      payTypes: payTypes
    }
  }
}

export default buildMockAnalytics
