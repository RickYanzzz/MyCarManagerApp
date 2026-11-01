/**
 * 前端排班时间工具（轻量版）
 *
 * 与 uniCloud-aliyun/cloudfunctions/appointment_api/lib/schedule.js 同源同口径：
 * 一律按北京时间换算，不依赖设备/容器时区。改动其中一份时两份要一起改。
 * 这里只保留页面真正要用的部分（日期切换、档位、冲突预览），
 * 看板上的 startSlot / spanSlots 直接使用服务端返回值，避免两端算法漂移。
 */

export const MINUTE_MS = 60 * 1000
export const DAY_MS = 24 * 60 * MINUTE_MS
export const BEIJING_OFFSET_MS = 8 * 60 * MINUTE_MS

export const DEFAULT_CONFIG = {
	slotMinutes: 60,
	openMinutes: 8 * 60,
	closeMinutes: 19 * 60,
	startAlignMinutes: 30,
	bayCount: 3
}

export const STATUS_TEXT = {
	0: '待到店',
	1: '施工中',
	2: '已完成',
	3: '已取消',
	4: '未到店'
}

/** 状态色：蓝=待到店 橙=施工中 绿=已完成 灰=已取消 红=未到店 */
export const STATUS_COLOR = {
	0: '#6EA0F7',
	1: '#F2B36B',
	2: '#7EC8B8',
	3: '#C8CFDA',
	4: '#E58B8B'
}

const WEEKDAY_TEXT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function pad2(n) {
	return n < 10 ? '0' + n : String(n)
}

export function toTimestamp(value) {
	if (value === null || value === undefined) return NaN
	if (value instanceof Date) return value.getTime()
	if (typeof value === 'number') return value
	if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim())
	return NaN
}

export function beijingParts(ts) {
	const t = toTimestamp(ts)
	if (isNaN(t)) return null
	const d = new Date(t + BEIJING_OFFSET_MS)
	return {
		year: d.getUTCFullYear(),
		month: d.getUTCMonth() + 1,
		day: d.getUTCDate(),
		minutesOfDay: d.getUTCHours() * 60 + d.getUTCMinutes(),
		weekday: d.getUTCDay()
	}
}

export function beijingDayStart(ts) {
	const p = beijingParts(ts)
	if (!p) return NaN
	return Date.UTC(p.year, p.month - 1, p.day) - BEIJING_OFFSET_MS
}

export function dayStartFromKey(key) {
	const m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(String(key || '').trim())
	if (!m) return NaN
	return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - BEIJING_OFFSET_MS
}

export function dateKeyOf(ts) {
	const p = beijingParts(ts)
	if (!p) return ''
	return p.year + '-' + pad2(p.month) + '-' + pad2(p.day)
}

export function todayKey() {
	return dateKeyOf(Date.now())
}

/** 日期键加减天数，返回新的日期键 */
export function shiftDayKey(key, offset) {
	const start = dayStartFromKey(key)
	if (isNaN(start)) return ''
	return dateKeyOf(start + (offset || 0) * DAY_MS)
}

export function atMinutes(dayStartTs, minutes) {
	return toTimestamp(dayStartTs) + minutes * MINUTE_MS
}

export function hhmm(minutes) {
	const total = Math.round(minutes)
	return pad2(Math.floor(total / 60)) + ':' + pad2(total % 60)
}

/** '11月1日 周日' */
export function shortDateLabel(key) {
	const p = beijingParts(dayStartFromKey(key))
	if (!p) return ''
	return p.month + '月' + p.day + '日 ' + WEEKDAY_TEXT[p.weekday]
}

/** '今天' / '明天' / '昨天' / '11月3日 周二' */
export function relativeDateLabel(key) {
	const today = todayKey()
	if (key === today) return '今天'
	if (key === shiftDayKey(today, 1)) return '明天'
	if (key === shiftDayKey(today, -1)) return '昨天'
	return shortDateLabel(key)
}

export function normalizeConfig(input) {
	const raw = input && typeof input === 'object' ? input : {}
	const slotMinutes = parseInt(raw.slotMinutes, 10) || DEFAULT_CONFIG.slotMinutes
	const openMinutes = isNaN(parseInt(raw.openMinutes, 10)) ? DEFAULT_CONFIG.openMinutes : parseInt(raw.openMinutes, 10)
	const closeMinutes = isNaN(parseInt(raw.closeMinutes, 10)) ? DEFAULT_CONFIG.closeMinutes : parseInt(raw.closeMinutes, 10)
	return {
		slotMinutes: slotMinutes,
		openMinutes: openMinutes,
		closeMinutes: closeMinutes > openMinutes ? closeMinutes : DEFAULT_CONFIG.closeMinutes,
		startAlignMinutes: parseInt(raw.startAlignMinutes, 10) || DEFAULT_CONFIG.startAlignMinutes,
		bayCount: isNaN(parseInt(raw.bayCount, 10)) ? DEFAULT_CONFIG.bayCount : Math.max(0, parseInt(raw.bayCount, 10))
	}
}

export function buildSlots(config) {
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

/** 生成可选的开始时间（按 startAlignMinutes 对齐），供表单 picker 使用 */
export function buildStartOptions(config) {
	const cfg = normalizeConfig(config)
	const options = []
	for (let m = cfg.openMinutes; m < cfg.closeMinutes; m += cfg.startAlignMinutes) {
		options.push({ minutes: m, label: hhmm(m) })
	}
	return options
}

export function resolveDuration(appointment) {
	const a = appointment || {}
	const d = parseInt(a.duration, 10)
	if (!isNaN(d) && d > 0) return d
	const start = toTimestamp(a.startTime)
	const end = toTimestamp(a.endTime)
	if (!isNaN(start) && !isNaN(end) && end > start) return Math.round((end - start) / MINUTE_MS)
	return DEFAULT_CONFIG.slotMinutes
}

export function resolveEndTime(appointment) {
	const a = appointment || {}
	const end = toTimestamp(a.endTime)
	if (!isNaN(end)) return end
	const start = toTimestamp(a.startTime)
	if (isNaN(start)) return NaN
	return start + resolveDuration(a) * MINUTE_MS
}

/** 是否跨自然日 */
export function crossesDay(appointment) {
	const start = toTimestamp(appointment && appointment.startTime)
	const end = resolveEndTime(appointment)
	if (isNaN(start) || isNaN(end)) return false
	return beijingDayStart(end) > beijingDayStart(start)
}

export function timeRangeText(appointment) {
	const start = toTimestamp(appointment && appointment.startTime)
	const end = resolveEndTime(appointment)
	if (isNaN(start) || isNaN(end)) return ''
	const s = beijingParts(start)
	const e = beijingParts(end)
	const next = beijingDayStart(end) > beijingDayStart(start) ? '次日' : ''
	return hhmm(s.minutesOfDay) + '-' + next + hhmm(e.minutesOfDay)
}

/**
 * 表单里的结束时间文案：当天 18:00 + 4 小时 → '22:00'，
 * 跨天 → '次日 02:00'。hhmm 不做 24 小时回绕，否则会显示成 26:00。
 */
export function endLabelOf(startMinutes, duration) {
	const total = (parseInt(startMinutes, 10) || 0) + (parseInt(duration, 10) || 0)
	const dayOffset = Math.floor(total / (24 * 60))
	const rest = total % (24 * 60)
	if (dayOffset <= 0) return hhmm(rest)
	return (dayOffset === 1 ? '次日 ' : dayOffset + ' 天后 ') + hhmm(rest)
}

export function isOccupying(status) {
	const n = Number(status)
	return n === 0 || n === 1
}

export function overlaps(aStart, aEnd, bStart, bEnd) {
	return aStart < bEnd && bStart < aEnd
}

/** 本地冲突预览：与服务端同一套规则，仅用于表单即时提示 */
export function findConflicts(list, draft) {
	const start = toTimestamp(draft && draft.startTime)
	if (isNaN(start)) return []
	const duration = parseInt(draft.duration, 10) || 0
	const end = start + duration * MINUTE_MS
	const technicianId = String((draft && draft.technicianId) || '')
	return (list || []).filter(item => {
		if (!item) return false
		if (draft && draft.excludeId && item._id === draft.excludeId) return false
		if (String(item.technicianId || '') !== technicianId) return false
		if (!isOccupying(item.status)) return false
		const s = toTimestamp(item.startTime)
		const e = resolveEndTime(item)
		if (isNaN(s) || isNaN(e)) return false
		return overlaps(start, end, s, e)
	})
}

/** 该师傅当天已被占用的档位 index 集合 */
export function occupiedSlotIndexes(list, technicianId, config) {
	const cfg = normalizeConfig(config)
	const busy = (list || []).filter(item =>
		String(item.technicianId || '') === String(technicianId || '') && isOccupying(item.status)
	)
	const indexes = []
	busy.forEach(item => {
		const p = beijingParts(item.startTime)
		if (!p) return
		const span = Math.max(1, Math.ceil(resolveDuration(item) / cfg.slotMinutes))
		const startSlot = Math.floor((p.minutesOfDay - cfg.openMinutes) / cfg.slotMinutes)
		for (let i = 0; i < span; i++) {
			const idx = startSlot + i
			if (idx >= 0 && indexes.indexOf(idx) < 0) indexes.push(idx)
		}
	})
	return indexes
}

/** 与草稿时段重叠、且仍在占用的预约（不限师傅） */
export function overlappingOccupied(list, draft) {
	const d = draft || {}
	const start = toTimestamp(d.startTime)
	if (isNaN(start)) return []
	// 草稿可能只带 duration（表单），也可能只带 endTime（服务端调用），两种都要认
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
 * 工位占用预览，规则与云函数 lib/schedule.js 的 bayPlan 一致。
 * 只用于表单里的即时提示与服务端返回前的乐观展示，保存仍以服务端结果为准。
 */
export function bayPlan(list, draft, config) {
	const cfg = normalizeConfig(config)
	const items = overlappingOccupied(list, draft)
	const bayCount = cfg.bayCount
	if (!bayCount) {
		return { limited: false, bayCount: 0, occupiedCount: items.length, usedBays: [], freeBays: [], suggestedBay: 0, full: false, items: items }
	}
	const usedBays = []
	const legacy = []
	items.forEach(item => {
		const bay = parseInt(item.bayNo, 10)
		if (bay >= 1 && bay <= bayCount && usedBays.indexOf(bay) < 0) usedBays.push(bay)
		else legacy.push(item)
	})
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
