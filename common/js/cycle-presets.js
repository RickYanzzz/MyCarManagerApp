/**
 * 汽车保养 & 美容周期标准（2026-11-01 定版）
 * 来源：店主确认的《汽车保养 & 美容周期一览》
 *
 * 用途：
 * 1. 添加消费项目时，按名称关键词匹配出该项目的 category / cycleDays / cycleKm，
 *    作为快照写入 purchased_goods（回访规则 R6 保养到期依此计算"上次保养"）。
 * 2. 后续给项目库（goods）补 category / cycleDays 时也以这里为唯一标准。
 *
 * 规则：区间一律取下限（提醒宁早勿晚），周期单位为天。
 * 周期 = "只看时间不看里程"的场景（刹车油、美容类等）。
 */

export const CATEGORY_TEXT = {
	1: '保养',
	2: '洗美',
	3: '轮胎',
	4: '其他'
}

// 保养 / 易损件周期表（取自截图"增持保养项目明细周期表"）
// 注意顺序：更具体的关键词（半合成/矿物油）在前，兜底的"机油/小保养"放全合成条目里最后匹配
export const MAINTENANCE_CYCLES = [{
		keywords: ['半合成'],
		name: '机油+机油滤芯（半合成）',
		category: '保养',
		cycleKm: '7500',
		cycleDays: 240,
		note: '半合成建议提前 20%-30% 里程'
	},
	{
		keywords: ['矿物油', '矿物体'],
		name: '机油+机油滤芯（矿物油）',
		category: '保养',
		cycleKm: '5000',
		cycleDays: 180,
		note: '机油更换后发动机润滑效率开始快速变差'
	},
	{
		keywords: ['全合成', '机油', '小保养', '保养'],
		name: '机油+机油滤芯（全合成）',
		category: '保养',
		cycleKm: '10000',
		cycleDays: 365,
		note: '1万公里或1年，先到为准；未注明油品类型的默认按全合成'
	},
	{
		keywords: ['空调滤'],
		name: '空调滤芯',
		category: '保养',
		cycleKm: '10000-15000',
		cycleDays: 365,
		note: '检查为主，满座或经过过隧道路段时提前'
	},
	{
		keywords: ['空气滤'],
		name: '空气滤芯',
		category: '保养',
		cycleKm: '10000-15000',
		cycleDays: 365
	},
	{
		keywords: ['汽油滤'],
		name: '汽油滤芯',
		category: '保养',
		cycleKm: '20000-30000',
		cycleDays: 540,
		note: '视油品与环境'
	},
	{
		keywords: ['刹车油', '制动液'],
		name: '刹车油',
		category: '保养',
		cycleDays: 730,
		note: '含水量超标即需更换，只看时间'
	},
	{
		keywords: ['防冻液', '冷却液'],
		name: '防冻液',
		category: '保养',
		cycleDays: 730,
		note: '长效型可达 10 年 / 20 万公里，按 2 年提醒'
	},
	{
		keywords: ['火花塞'],
		name: '火花塞（依金）',
		category: '保养',
		cycleKm: '30000-50000',
		cycleDays: 730,
		note: '普通 3-5 万公里 1-2 年；依金 6-9 万 3-4 年可手动改'
	},
	{
		keywords: ['轮胎换位'],
		name: '轮胎换位',
		category: '保养',
		cycleKm: '40000',
		cycleDays: 730
	},
	{
		keywords: ['轮胎'],
		name: '轮胎',
		category: '轮胎',
		cycleKm: '40000-50000',
		cycleDays: 1095,
		note: '4-7 万公里或 3 年，先到为准'
	},
	{
		keywords: ['蓄电池', '电瓶'],
		name: '蓄电池',
		category: '保养',
		cycleDays: 540,
		note: '启动无力前提前检查，1.5-2 年'
	},
	{
		keywords: ['刹车片', '制动片'],
		name: '刹车片',
		category: '保养',
		cycleKm: '40000-70000',
		cycleDays: 730,
		note: '以实际磨损为准'
	},
	{
		keywords: ['雨刮', '雨刷', '刮水器'],
		name: '雨刮片',
		category: '易损件',
		cycleDays: 365,
		note: '刮不干净即可提前换'
	}
]

// 汽车美容项目周期表（取自截图"汽车美容项目周期"）
export const BEAUTY_CYCLES = [{
		keywords: ['洗液打蜡', '清洗打蜡', '打蜡'],
		name: '清洗打蜡',
		category: '洗美',
		cycleDays: 45,
		note: '1-2 个月一次，雨前雨后建议 24 小时内修复'
	},
	{
		keywords: ['内饰桑拿', '内饰清洗', '桑拿洗'],
		name: '内饰桑拿洗',
		category: '洗美',
		cycleDays: 60,
		note: '1-3 个月，延迟喷洒效果变差'
	},
	{
		keywords: ['漆面划痕', '划痕修复', '划痕'],
		name: '漆面划痕修复',
		category: '洗美',
		cycleDays: 60,
		note: '1-3 个月'
	},
	{
		keywords: ['镀晶', '封釉', '镀膜'],
		name: '全车漆面镀晶',
		category: '洗美',
		cycleDays: 180,
		note: '6 个月 - 1 年，按半年提醒'
	},
	{
		keywords: ['空调清洗', '空调消毒', '空调养护'],
		name: '空调清洗',
		category: '保养',
		cycleDays: 180,
		note: '半年 / 1 年，出风口异味时优先'
	}
]

/**
 * 按项目名称匹配周期标准
 * @param {String} name 项目名称（如"小保养（全合成）"、"清洗打蜡"）
 * @returns {Object|null} { category, cycleDays, cycleKm, cycleName, note }
 */
export function matchCycleByName(name) {
	const text = String(name || '').trim()
	if (!text) return null
	// 美容表优先（"清洗打蜡"不应被"保养"兜底吃掉）
	const pools = [BEAUTY_CYCLES, MAINTENANCE_CYCLES]
	for (const pool of pools) {
		for (const item of pool) {
			if (item.keywords.some(k => text.indexOf(k) > -1)) {
				return {
					category: item.category,
					cycleDays: item.cycleDays,
					cycleKm: item.cycleKm || '',
					cycleName: item.name,
					note: item.note || ''
				}
			}
		}
	}
	return null
}

export default {
	CATEGORY_TEXT,
	MAINTENANCE_CYCLES,
	BEAUTY_CYCLES,
	matchCycleByName
}
