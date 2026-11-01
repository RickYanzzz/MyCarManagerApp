'use strict'

/**
 * 预约排班纯逻辑
 *
 * 本模块不依赖 uniCloud / uni-app，可被云函数与 node 测试直接 require。
 *
 * 设计要点：
 * 1. 所有时间运算显式按北京时间（UTC+8）换算，不依赖运行环境本地时区。
 *    云函数容器通常是 UTC，用 new Date().getHours() 会把 08:00 的预约算成 00:00。
 * 2. 排班表的一行 = 一位师傅，一格 = 一个时段（默认 60 分钟），
 *    起约时间对齐 30 分钟，允许一格被两个短项目共用。
 * 3. 「冲突」只由「师傅 + 时间区间重叠 + 状态仍占用」三者共同决定：
 *    已取消、未到店、已完成的预约不占位。
 * 4. 跨天预约按「时间区间与当天有交集」归入当天视图：
 *    昨天 18:00 干到今天 10:00 的单，今天的表上会从 08:00 那一格起显示一段「续」。
 *    一天只按开始时间归档的话，这种单在第二天会整条消失。
 * 5. 工位（举升机）容量与师傅容量相互独立：
 *    同一时刻占用的工位数不能超过 bayCount，0 表示不限。
 *    工位号按「重叠时段内已用的号」自动补空位，不要求人工指定。
 */

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const BEIJING_OFFSET_MS = 8 * HOUR_MS

const DEFAULT_CONFIG = {
  slotMinutes: 60,
  openMinutes: 8 * 60,
  closeMinutes: 19 * 60,
  startAlignMinutes: 30,
  bayCount: 3
}

// 允许跨天：最长 24 小时（例如 18:00 接车、次日 10:00 交车的贴膜/大修）
const MAX_DURATION_MINUTES = 24 * 60

/** 预约状态 */
const STATUS = {
  BOOKED: 0,
  WORKING: 1,
  DONE: 2,
  CANCELLED: 3,
  NO_SHOW: 4
}

const STATUS_TEXT = {
  0: '待到店',
  1: '施工中',
  2: '已完成',
  3: '已取消',
  4: '未到店'
}

/** 只有这两个状态占用师傅的时间 */
const OCCUPYING_STATUS = [STATUS.BOOKED, STATUS.WORKING]

const WEEKDAY_TEXT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/* ------------------------------------------------------------------ */
/* 北京时间换算                                                       */
/* ------------------------------------------------------------------ */

function toTimestamp(value) {
  if (value === null || value === undefined) return NaN
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d+$/.test(trimmed)) return Number(trimmed)
    const parsed = Date.parse(trimmed)
    return isNaN(parsed) ? NaN : parsed
  }
  return NaN
}

/** 拆出北京时间的年月日时分 */
function beijingParts(ts) {
  const t = toTimestamp(ts)
  if (isNaN(t)) return null
  const d = new Date(t + BEIJING_OFFSET_MS)
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: d.getUTCDay(),
    minutesOfDay: d.getUTCHours() * 60 + d.getUTCMinutes()
  }
}

/** 北京时间当天 00:00 的时间戳 */
function beijingDayStart(ts) {
  const p = beijingParts(ts)
  if (!p) return NaN
  return Date.UTC(p.year, p.month - 1, p.day) - BEIJING_OFFSET_MS
}

/** 'YYYY-MM-DD' / 'YYYY/MM/DD' → 北京时间当天 00:00 时间戳 */
function dayStartFromKey(key) {
  const m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(String(key || '').trim())
  if (!m) return NaN
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - BEIJING_OFFSET_MS
}

/** 时间戳 → 北京时间 'YYYY-MM-DD' */
function dateKeyOf(ts) {
  const p = beijingParts(ts)
  if (!p) return ''
  return p.year + '-' + pad2(p.month) + '-' + pad2(p.day)
}

/** 北京时间当日 0 点基础上偏移若干分钟 */
function atMinutes(dayStartTs, minutes) {
  return toTimestamp(dayStartTs) + minutes * MINUTE_MS
}

/** 差几天（以北京自然日为准） */
function diffDays(dayStartTs, otherTs) {
  return Math.round((beijingDayStart(otherTs) - beijingDayStart(dayStartTs)) / DAY_MS)
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n)
}

/** 分钟数 → 'HH:mm'，允许超过 24 点（如 1500 → '25:00' 会回绕，请勿传超范围） */
function hhmm(minutes) {
  const total = Math.round(minutes)
  const h = Math.floor(total / 60)
  const m = total % 60
  return pad2(h) + ':' + pad2(m)
}

function dateLabel(key) {
  const start = dayStartFromKey(key)
  if (isNaN(start)) return ''
  const p = beijingParts(start)
  return p.year + '年' + p.month + '月' + p.day + '日 ' + WEEKDAY_TEXT[p.weekday]
}

/* ------------------------------------------------------------------ */
/* 配置与时段                                                         */
/* ------------------------------------------------------------------ */

function normalizeConfig(input) {
  const raw = input && typeof input === 'object' ? input : {}
  const slotMinutes = clampInt(raw.slotMinutes, 15, 240, DEFAULT_CONFIG.slotMinutes)
  const openMinutes = clampInt(raw.openMinutes, 0, 23 * 60, DEFAULT_CONFIG.openMinutes)
  let closeMinutes = clampInt(raw.closeMinutes, openMinutes + slotMinutes, 24 * 60, DEFAULT_CONFIG.closeMinutes)
  if (closeMinutes <= openMinutes) closeMinutes = DEFAULT_CONFIG.closeMinutes
  return {
    slotMinutes: slotMinutes,
    openMinutes: openMinutes,
    closeMinutes: closeMinutes,
    startAlignMinutes: clampInt(raw.startAlignMinutes, 5, 60, DEFAULT_CONFIG.startAlignMinutes),
    // 0 = 不做工位约束；正常门店填实际车位数
    bayCount: clampInt(raw.bayCount, 0, 60, DEFAULT_CONFIG.bayCount)
  }
}

function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10)
  if (isNaN(n)) return fallback
  if (n < min) return min
  if (n > max) return max
  return n
}

/** 生成排班表的列：09:00–19:00 / 60 分钟 → 11 档 */
function buildSlots(config) {
  const cfg = normalizeConfig(config)
  const slots = []
  for (let m = cfg.openMinutes; m < cfg.closeMinutes; m += cfg.slotMinutes) {
    const end = Math.min(m + cfg.slotMinutes, cfg.closeMinutes)
    slots.push({
      index: slots.length,
      startMinutes: m,
      endMinutes: end,
      label: hhmm(m),
      endLabel: hhmm(end),
      rangeText: hhmm(m) + '-' + hhmm(end)
    })
  }
  return slots
}

/** 某时刻落在第几档；早于开门/晚于关门返回 -1 */
function slotIndexOf(startTime, config) {
  const cfg = normalizeConfig(config)
  const p = beijingParts(startTime)
  if (!p) return -1
  if (p.minutesOfDay < cfg.openMinutes || p.minutesOfDay >= cfg.closeMinutes) return -1
  return Math.floor((p.minutesOfDay - cfg.openMinutes) / cfg.slotMinutes)
}

/**
 * 预约在排班表上占用几格、从第几格开始。
 *
 * dayStartTs 传入「正在看的那一天」的 0 点：
 * - 昨天开始、今天还在做的单 → startSlot 落在 0，并标记 startsBeforeDay
 * - 今天开始、干到明天的单 → clippedSpan 截到当天最后一格，并标记 endsAfterDay
 * 不传 dayStart 时按预约自己的开始日期计算，等价于老行为。
 */
function slotSpanOf(appointment, config, dayStartTs) {
  const cfg = normalizeConfig(config)
  const a = appointment || {}
  const start = toTimestamp(a.startTime)
  if (isNaN(start)) return { startSlot: -1, spanSlots: 0, clippedSpan: 0, visible: false }
  const end = resolveEndTime(a)
  const base = isNaN(toTimestamp(dayStartTs)) ? beijingDayStart(start) : toTimestamp(dayStartTs)
  const spanSlots = Math.max(1, Math.ceil(resolveDuration(a) / cfg.slotMinutes))

  // 相对当天的分钟区间：昨天开始的会是负数
  const fromMin = (start - base) / MINUTE_MS
  const toMin = (end - base) / MINUTE_MS

  const startsBeforeDay = fromMin < cfg.openMinutes
  const endsAfterDay = toMin > cfg.closeMinutes

  // 与当天营业区间无交集 → 当天不显示
  if (!isFinite(toMin) || toMin <= cfg.openMinutes || fromMin >= cfg.closeMinutes) {
    return { startSlot: -1, spanSlots: spanSlots, clippedSpan: 0, visible: false, startsBeforeDay, endsAfterDay }
  }

  const startSlot = fromMin <= cfg.openMinutes
    ? 0
    : Math.floor((fromMin - cfg.openMinutes) / cfg.slotMinutes)
  const totalSlots = buildSlots(cfg).length
  const endSlotExclusive = Math.min(
    totalSlots,
    Math.ceil((Math.min(toMin, cfg.closeMinutes) - cfg.openMinutes) / cfg.slotMinutes)
  )
  return {
    startSlot: Math.max(0, startSlot),
    spanSlots: spanSlots,
    clippedSpan: Math.max(1, endSlotExclusive - Math.max(0, startSlot)),
    visible: true,
    startsBeforeDay: startsBeforeDay,
    endsAfterDay: endsAfterDay
  }
}

/* ------------------------------------------------------------------ */
/* 预约自身的时间推导                                                 */
/* ------------------------------------------------------------------ */

function resolveDuration(appointment) {
  const a = appointment || {}
  const fromField = parseInt(a.duration, 10)
  if (!isNaN(fromField) && fromField > 0) return fromField
  const start = toTimestamp(a.startTime)
  const end = toTimestamp(a.endTime)
  if (!isNaN(start) && !isNaN(end) && end > start) {
    return Math.round((end - start) / MINUTE_MS)
  }
  return DEFAULT_CONFIG.slotMinutes
}

function resolveEndTime(appointment) {
  const a = appointment || {}
  const end = toTimestamp(a.endTime)
  if (!isNaN(end)) return end
  const start = toTimestamp(a.startTime)
  if (isNaN(start)) return NaN
  return start + resolveDuration(a) * MINUTE_MS
}

/** 是否跨自然日（按北京时间判断） */
function crossesDay(appointment) {
  const start = toTimestamp(appointment && appointment.startTime)
  const end = resolveEndTime(appointment)
  if (isNaN(start) || isNaN(end)) return false
  return beijingDayStart(end) > beijingDayStart(start)
}

/** '08:00-09:30'；跨天显示为 '18:00-次日10:00' */
function timeRangeText(appointment) {
  const start = toTimestamp(appointment && appointment.startTime)
  const end = resolveEndTime(appointment)
  if (isNaN(start) || isNaN(end)) return ''
  const p = beijingParts(start)
  const e = beijingParts(end)
  const nextDay = beijingDayStart(end) > beijingDayStart(start) ? '次日' : ''
  return hhmm(p.minutesOfDay) + '-' + nextDay + hhmm(e.minutesOfDay)
}

/**
 * 看板上显示的时间文案：在 timeRangeText 基础上把「昨天开始」也标出来，
 * 否则今天 08:00 起的一段「续」会被误读成今天 18:00 才开工。
 */
function boardTimeText(appointment, dayStartTs) {
  const a = appointment || {}
  const start = toTimestamp(a.startTime)
  const end = resolveEndTime(a)
  if (isNaN(start) || isNaN(end)) return ''
  const base = isNaN(toTimestamp(dayStartTs)) ? beijingDayStart(start) : toTimestamp(dayStartTs)
  const p = beijingParts(start)
  const e = beijingParts(end)
  const prev = start < base ? '昨日 ' : ''
  const next = beijingDayStart(end) > beijingDayStart(start) ? '次日' : ''
  return prev + hhmm(p.minutesOfDay) + '-' + next + hhmm(e.minutesOfDay)
}

function isOccupying(status) {
  return OCCUPYING_STATUS.indexOf(Number(status)) >= 0
}

function statusText(status) {
  return STATUS_TEXT[Number(status)] || '未知'
}

/* ------------------------------------------------------------------ */
/* 冲突判定                                                           */
/* ------------------------------------------------------------------ */

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd
}

/**
 * 找出与草稿冲突的已有预约。
 * @param {Array} list 同门店、同一天的预约（也可传全量，靠时间区间过滤）
 * @param {Object} draft { technicianId, startTime, endTime|duration, excludeId }
 */
function findConflicts(list, draft) {
  const d = draft || {}
  const start = toTimestamp(d.startTime)
  if (isNaN(start)) return []
  const end = resolveEndTime({ startTime: start, endTime: d.endTime, duration: d.duration })
  const technicianId = String(d.technicianId || '')
  return (list || []).filter(item => {
    if (!item) return false
    if (d.excludeId && item._id === d.excludeId) return false
    if (String(item.technicianId || '') !== technicianId) return false
    if (!isOccupying(item.status)) return false
    const s = toTimestamp(item.startTime)
    const e = resolveEndTime(item)
    if (isNaN(s) || isNaN(e)) return false
    return overlaps(start, end, s, e)
  })
}

/** 该师傅当天还空着哪些档（返回档位 index 数组） */
function freeSlots(list, technicianId, config, dayStartTs) {
  const cfg = normalizeConfig(config)
  const slots = buildSlots(cfg)
  const items = list || []
  const base = isNaN(toTimestamp(dayStartTs))
    ? (items.length ? beijingDayStart(items[0].startTime) : NaN)
    : toTimestamp(dayStartTs)
  const busy = items.filter(item =>
    String(item.technicianId || '') === String(technicianId || '') && isOccupying(item.status)
  )
  return slots.filter(slot => {
    return !busy.some(item => {
      const start = toTimestamp(item.startTime)
      if (isNaN(start)) return false
      // 相对当天 0 点的分钟数；昨天开始的单为负，同样会盖住今天早上
      const itemStart = isNaN(base) ? 0 : (start - base) / MINUTE_MS
      const itemEnd = itemStart + resolveDuration(item)
      return overlaps(slot.startMinutes, slot.endMinutes, itemStart, itemEnd)
    })
  }).map(slot => slot.index)
}

/* ------------------------------------------------------------------ */
/* 工位（举升机）容量                                                 */
/* ------------------------------------------------------------------ */

/** 与草稿时间区间重叠、且仍在占用的预约（不限师傅） */
function overlappingOccupied(list, draft) {
  const d = draft || {}
  const start = toTimestamp(d.startTime)
  if (isNaN(start)) return []
  const end = resolveEndTime({ startTime: start, endTime: d.endTime, duration: d.duration })
  return (list || []).filter(item => {
    if (!item) return false
    if (d.excludeId && item._id === d.excludeId) return false
    if (!isOccupying(item.status)) return false
    const s = toTimestamp(item.startTime)
    const e = resolveEndTime(item)
    if (isNaN(s) || isNaN(e)) return false
    return overlaps(start, end, s, e)
  })
}

/**
 * 草稿时段的工位占用情况。
 *
 * 因为所有与草稿重叠的区间在一条时间轴上两两相交，
 * 「重叠条数」就等于该时段内的最大并发数，不需要再逐分钟扫描。
 *
 * @returns {{limited, bayCount, occupiedCount, usedBays, freeBays, suggestedBay, full, items}}
 */
function bayPlan(list, draft, config) {
  const cfg = normalizeConfig(config)
  const items = overlappingOccupied(list, draft)
  const bayCount = cfg.bayCount
  if (!bayCount) {
    return {
      limited: false, bayCount: 0, occupiedCount: items.length,
      usedBays: [], freeBays: [], suggestedBay: 0, full: false, items: items
    }
  }
  const usedBays = []
  const legacy = []
  items.forEach(item => {
    const bay = parseInt(item.bayNo, 10)
    if (bay >= 1 && bay <= bayCount && usedBays.indexOf(bay) < 0) usedBays.push(bay)
    else legacy.push(item)
  })
  // 没登记工位的历史单（或工位数变小后的溢出）按开始时间顺序补空位
  const spare = []
  for (let i = 1; i <= bayCount; i++) if (usedBays.indexOf(i) < 0) spare.push(i)
  legacy
    .slice()
    .sort((a, b) => toTimestamp(a.startTime) - toTimestamp(b.startTime))
    .forEach((item, idx) => {
      if (spare[idx]) usedBays.push(spare[idx])
    })
  const freeBays = []
  for (let i = 1; i <= bayCount; i++) if (usedBays.indexOf(i) < 0) freeBays.push(i)
  return {
    limited: true,
    bayCount: bayCount,
    occupiedCount: items.length,
    usedBays: usedBays.slice().sort((a, b) => a - b),
    freeBays: freeBays,
    suggestedBay: freeBays[0] || 0,
    full: freeBays.length === 0,
    items: items
  }
}

/**
 * 一天的工位负荷：逐档统计占用数，找出峰值与「已满」的档。
 * 用于看板顶部提示——师傅还没排满但车位已经不够，是另一个维度的瓶颈。
 */
function bayLoad(list, config, dayStartTs) {
  const cfg = normalizeConfig(config)
  const slots = buildSlots(cfg)
  const base = isNaN(toTimestamp(dayStartTs)) ? NaN : toTimestamp(dayStartTs)
  const items = (list || []).filter(item => item && isOccupying(item.status))
  const load = slots.map(slot => {
    const slotStart = slot.startMinutes
    const slotEnd = slot.endMinutes
    let count = 0
    items.forEach(item => {
      const start = toTimestamp(item.startTime)
      if (isNaN(start)) return
      const itemStart = isNaN(base) ? 0 : (start - base) / MINUTE_MS
      const itemEnd = itemStart + resolveDuration(item)
      if (overlaps(slotStart, slotEnd, itemStart, itemEnd)) count++
    })
    return count
  })
  let peak = 0
  let peakIndex = -1
  load.forEach((n, i) => {
    if (n > peak) {
      peak = n
      peakIndex = i
    }
  })
  const fullSlots = []
  if (cfg.bayCount > 0) {
    load.forEach((n, i) => {
      if (n >= cfg.bayCount) fullSlots.push(i)
    })
  }
  return {
    bayCount: cfg.bayCount,
    load: load,
    peak: peak,
    peakLabel: peakIndex >= 0 ? slots[peakIndex].rangeText : '',
    fullSlots: fullSlots,
    fullLabels: fullSlots.map(i => slots[i].rangeText)
  }
}

/* ------------------------------------------------------------------ */
/* 校验                                                               */
/* ------------------------------------------------------------------ */

/**
 * 校验一份预约草稿。
 * 返回 { ok, errors:[], warnings:[], normalized:{} }
 * errors 会拦截保存，warnings 只提示。
 */
function validateDraft(input, config) {
  const cfg = normalizeConfig(config)
  const d = input || {}
  const errors = []
  const warnings = []

  const technicianId = String(d.technicianId || '').trim()
  if (!technicianId) errors.push('请选择师傅')

  const start = toTimestamp(d.startTime)
  if (isNaN(start)) errors.push('请选择预约开始时间')

  let duration = parseInt(d.duration, 10)
  if (isNaN(duration) || duration <= 0) {
    duration = 0
    const items = Array.isArray(d.items) ? d.items : []
    items.forEach(it => {
      duration += parseInt(it && it.duration, 10) || 0
    })
    if (duration <= 0) duration = cfg.slotMinutes
  }
  if (duration > MAX_DURATION_MINUTES) errors.push('预约时长不能超过 24 小时')

  const customerName = String(d.customerName || '').trim()
  const memberId = String(d.memberId || '').trim()
  const carInfoId = String(d.carInfoId || '').trim()
  if (!customerName && !memberId && !carInfoId) errors.push('请至少填写客户姓名，或选择会员/车辆')

  let normalizedStart = start
  if (!isNaN(start)) {
    const p = beijingParts(start)
    const remainder = p.minutesOfDay % cfg.startAlignMinutes
    if (remainder !== 0) {
      // 自动吸附到最近的整点/半点，而不是直接报错，减少前台操作摩擦
      const aligned = p.minutesOfDay - remainder
      normalizedStart = atMinutes(beijingDayStart(start), aligned)
      warnings.push('开始时间已按 ' + cfg.startAlignMinutes + ' 分钟对齐到 ' + hhmm(aligned))
    }
    if (p.minutesOfDay < cfg.openMinutes || p.minutesOfDay >= cfg.closeMinutes) {
      warnings.push('该时间不在营业时间 ' + hhmm(cfg.openMinutes) + '-' + hhmm(cfg.closeMinutes) + ' 内')
    }
  }

  const normalizedDuration = duration
  const normalizedEnd = isNaN(normalizedStart) ? NaN : normalizedStart + normalizedDuration * MINUTE_MS

  // 跨天只提示不拦截：18:00 接车、次日交车是正常业务，
  // 但要让前台知道这单会占掉第二天早上的时段。
  if (!isNaN(normalizedEnd) && !isNaN(normalizedStart)) {
    const endParts = beijingParts(normalizedEnd)
    const crossDays = beijingDayStart(normalizedEnd) > beijingDayStart(normalizedStart)
    if (crossDays) {
      warnings.push('该预约跨天，结束时间为次日 ' + hhmm(endParts.minutesOfDay) +
        '（会占用次日的时段与工位）')
    } else if (endParts.minutesOfDay > cfg.closeMinutes) {
      warnings.push('结束时间 ' + hhmm(endParts.minutesOfDay) + ' 已超出营业时间 ' +
        hhmm(cfg.closeMinutes) + '，请确认有人值守')
    }
  }

  return {
    ok: errors.length === 0,
    errors: errors,
    warnings: warnings,
    normalized: {
      technicianId: technicianId,
      startTime: normalizedStart,
      endTime: normalizedEnd,
      duration: normalizedDuration,
      customerName: customerName,
      memberId: memberId,
      carInfoId: carInfoId
    }
  }
}

/** 某日某时段的建议结束时间，用于表单联动 */
function endTimeOf(startTime, duration) {
  const start = toTimestamp(startTime)
  if (isNaN(start)) return NaN
  return start + (parseInt(duration, 10) || 0) * MINUTE_MS
}

/* ------------------------------------------------------------------ */
/* 汇总                                                               */
/* ------------------------------------------------------------------ */

/**
 * 一天的预约概览，用于看板顶部的数字条。
 * options.dayStart 传入当天 0 点后，占用时长会按当天营业区间裁剪，
 * 跨天预约不会把昨天的 8 小时也算到今天头上。
 */
function summarize(list, options) {
  const opts = options || {}
  const cfg = normalizeConfig(opts)
  const technicianCount = Math.max(0, parseInt(opts.technicianCount, 10) || 0)
  const base = toTimestamp(opts.dayStart)
  const winStart = isNaN(base) ? NaN : base + cfg.openMinutes * MINUTE_MS
  const winEnd = isNaN(base) ? NaN : base + cfg.closeMinutes * MINUTE_MS
  const result = {
    total: 0,
    booked: 0,
    working: 0,
    done: 0,
    cancelled: 0,
    noShow: 0,
    crossDayCount: 0,
    occupiedMinutes: 0,
    conflictCount: 0,
    loadRate: 0
  }
  ;(list || []).forEach(item => {
    if (!item) return
    const status = Number(item.status)
    if (status === STATUS.CANCELLED) {
      result.cancelled++
      return
    }
    result.total++
    if (status === STATUS.BOOKED) result.booked++
    if (status === STATUS.WORKING) result.working++
    if (status === STATUS.DONE) result.done++
    if (status === STATUS.NO_SHOW) result.noShow++
    if (crossesDay(item)) result.crossDayCount++
    if (isOccupying(status)) {
      let minutes = resolveDuration(item)
      if (!isNaN(winStart)) {
        const s = toTimestamp(item.startTime)
        const e = resolveEndTime(item)
        const from = Math.max(s, winStart)
        const to = Math.min(e, winEnd)
        minutes = to > from ? Math.round((to - from) / MINUTE_MS) : 0
      }
      result.occupiedMinutes += minutes
    }
  })

  const capacity = technicianCount * Math.max(0, cfg.closeMinutes - cfg.openMinutes)
  if (capacity > 0) {
    result.loadRate = Math.min(1, result.occupiedMinutes / capacity)
  }
  return result
}

/**
 * 找出同一师傅当天互相重叠的预约对。
 * 正常录入不会产生，但历史数据 / 并发提交可能留下，看板需要用红框标出来。
 */
function detectConflictPairs(list) {
  const occupying = (list || []).filter(item => item && isOccupying(item.status))
  const pairs = []
  for (let i = 0; i < occupying.length; i++) {
    for (let j = i + 1; j < occupying.length; j++) {
      const a = occupying[i]
      const b = occupying[j]
      if (String(a.technicianId) !== String(b.technicianId)) continue
      if (overlaps(toTimestamp(a.startTime), resolveEndTime(a), toTimestamp(b.startTime), resolveEndTime(b))) {
        pairs.push([a._id, b._id])
      }
    }
  }
  return pairs
}

/** 同一个工位号被两单同时占用的异常对（改小工位数、手工指定都可能造成） */
function detectBayConflictPairs(list) {
  const occupying = (list || []).filter(item =>
    item && isOccupying(item.status) && parseInt(item.bayNo, 10) > 0
  )
  const pairs = []
  for (let i = 0; i < occupying.length; i++) {
    for (let j = i + 1; j < occupying.length; j++) {
      const a = occupying[i]
      const b = occupying[j]
      if (parseInt(a.bayNo, 10) !== parseInt(b.bayNo, 10)) continue
      if (overlaps(toTimestamp(a.startTime), resolveEndTime(a), toTimestamp(b.startTime), resolveEndTime(b))) {
        pairs.push([a._id, b._id])
      }
    }
  }
  return pairs
}

/** 把预约按「天 + 师傅」分组，方便看板逐行取数 */
function groupByTechnician(list) {
  const map = {}
  ;(list || []).forEach(item => {
    if (!item) return
    const key = String(item.technicianId || '')
    if (!map[key]) map[key] = []
    map[key].push(item)
  })
  return map
}

module.exports = {
  MINUTE_MS,
  HOUR_MS,
  DAY_MS,
  BEIJING_OFFSET_MS,
  DEFAULT_CONFIG,
  MAX_DURATION_MINUTES,
  STATUS,
  STATUS_TEXT,
  OCCUPYING_STATUS,
  WEEKDAY_TEXT,
  toTimestamp,
  beijingParts,
  beijingDayStart,
  dayStartFromKey,
  dateKeyOf,
  atMinutes,
  diffDays,
  hhmm,
  dateLabel,
  normalizeConfig,
  buildSlots,
  slotIndexOf,
  slotSpanOf,
  resolveDuration,
  resolveEndTime,
  timeRangeText,
  boardTimeText,
  crossesDay,
  isOccupying,
  statusText,
  overlaps,
  findConflicts,
  freeSlots,
  overlappingOccupied,
  bayPlan,
  bayLoad,
  validateDraft,
  endTimeOf,
  summarize,
  detectConflictPairs,
  detectBayConflictPairs,
  groupByTechnician
}
