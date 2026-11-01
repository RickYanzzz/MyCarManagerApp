'use strict'

/**
 * appointment_api —— 预约排班统一接口（action 路由）
 *
 * 为什么是一个函数而不是五个：
 * 排班的读、写、改状态共用同一套时段/冲突规则（lib/schedule.js），
 * 拆成多个函数要么复制逻辑、要么额外维护 uniCloud 公共模块，
 * 单函数一次上传即可用，规则只有一份。
 *
 * action：
 *   board          按天取「师傅 + 时段 + 当天预约」，看板主接口
 *                  （含昨天开始、今天仍在施工的跨天单，返回带「续」标记）
 *   save           新增 / 编辑预约（服务端二次校验：师傅时段冲突 + 工位容量）
 *   status         流转状态：0 待到店 1 施工中 2 已完成 3 已取消 4 未到店
 *   toOrder        一键转开单：建 order + 写入消费项目 + 回写 orderId
 *   setTechnician  把员工标记为师傅 / 取消标记（首次使用时批量开启）
 *
 * 两类容量约束分开判断：
 *   师傅冲突 —— 同一个人不可能同时干两单，硬约束；
 *   工位容量 —— bayCount 个举升机/车位，师傅够但工位不够时同样不能排。
 *
 * 鉴权：沿用会员模块的口径——只信任 userId，服务端反查 user 拿 enterpriseId，
 * 不采信客户端传来的 enterpriseId。注意当前项目没有 uni-id token，
 * userId 本身仍可被伪造，这块属于团队公共架构改造范围，本模块不擅自改动。
 */

const db = uniCloud.database()
const dbCmd = db.command

const S = require('./lib/schedule.js')

const COLL = {
  appointment: 'appointment',
  user: 'user',
  goods: 'goods',
  car: 'car_info',
  member: 'member',
  order: 'order',
  purchased: 'purchased_goods',
  config: 'app_config'
}

// 营业时间/时段粒度/工位数支持不建管理页面就改：往 app_config 写一条
// { key: 'appointment_config', value: { slotMinutes: 60, openMinutes: 480, closeMinutes: 1140, bayCount: 3 } }
// bayCount = 0 表示不做工位约束
const CONFIG_KEY = 'appointment_config'

// 师傅色板：按 _id 哈希取色，保证同一个人在任何日期都是同一个颜色
const TECH_COLORS = ['#6EA0F7', '#7EC8B8', '#F2B36B', '#B9A7F0', '#E58B8B', '#63B3C7', '#D4A373', '#8A94A6']

function ok(data, extra) {
  return Object.assign({ code: 200, status: 'success', data: data }, extra || {})
}

function fail(code, message, extra) {
  return Object.assign({ code: code, status: 'error', message: message }, extra || {})
}

function colorOf(id) {
  const str = String(id || '')
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) % 1000003
  }
  return TECH_COLORS[hash % TECH_COLORS.length]
}

function isEnabled(status) {
  return !(status === 0 || status === false || status === '0' || status === 'false')
}

function toInt(value, fallback) {
  const n = parseInt(value, 10)
  return isNaN(n) ? fallback : n
}

/* ------------------------------------------------------------------ */

async function getOperator(event) {
  const userId = String((event && event.userId) || '').trim()
  if (!userId) return { error: fail(401, '请先登录') }
  let res
  try {
    res = await db.collection(COLL.user).doc(userId).get()
  } catch (e) {
    return { error: fail(401, '用户不存在') }
  }
  const user = (res.data || [])[0]
  if (!user) return { error: fail(401, '用户不存在') }
  if (!isEnabled(user.status)) return { error: fail(403, '账号已停用') }
  if (!user.enterpriseId) return { error: fail(403, '该账号未绑定门店') }
  return { user: user, enterpriseId: user.enterpriseId, userId: user._id }
}

async function loadConfig() {
  try {
    const res = await db.collection(COLL.config).where({ key: CONFIG_KEY }).limit(1).get()
    const doc = res.data && res.data[0]
    if (doc && doc.value) {
      const parsed = typeof doc.value === 'string' ? JSON.parse(doc.value) : doc.value
      return S.normalizeConfig(parsed)
    }
  } catch (e) {
    // app_config 集合可能尚未创建，按默认营业时间走
  }
  return S.normalizeConfig()
}

/**
 * 取门店师傅。
 * 优先取显式标记 canBeTechnician: true 的员工；一个人都没标记时，
 * 退化为「全部门店员工」，并告诉前端需要去标记，避免首次打开看到空表。
 */
async function loadTechnicians(enterpriseId) {
  const res = await db.collection(COLL.user).where({ enterpriseId: enterpriseId }).limit(200).get()
  const staff = (res.data || [])
    .filter(u => isEnabled(u.status))
    .map(u => ({
      _id: u._id,
      name: u.realName || u.username || '未命名',
      phone: u.phoneNumber || '',
      canBeTechnician: u.canBeTechnician === true,
      color: colorOf(u._id)
    }))

  const flagged = staff.filter(u => u.canBeTechnician)
  const hasTechnicianFlag = flagged.length > 0
  return {
    technicians: hasTechnicianFlag ? flagged : staff,
    hasTechnicianFlag: hasTechnicianFlag,
    staffCount: staff.length
  }
}

function decorate(appointments, config, conflictIds, dayStart) {
  return (appointments || []).map(a => {
    const span = S.slotSpanOf(a, config, dayStart)
    return Object.assign({}, a, {
      status: Number(a.status),
      statusText: S.statusText(a.status),
      timeRangeText: S.timeRangeText(a),
      boardTimeText: S.boardTimeText(a, dayStart),
      duration: S.resolveDuration(a),
      bayNo: parseInt(a.bayNo, 10) || 0,
      startSlot: span.startSlot,
      spanSlots: span.spanSlots,
      clippedSpan: span.clippedSpan || 0,
      visible: span.visible,
      startsBeforeDay: !!span.startsBeforeDay,
      endsAfterDay: !!span.endsAfterDay,
      crossDay: S.crossesDay(a),
      hasConflict: conflictIds.indexOf(a._id) > -1,
      technicianColor: colorOf(a.technicianId)
    })
  })
}

/** 与某天有交集的预约：昨天开始、今天还没做完的也要取回来 */
function overlapsDay(appointment, dayStart, dayEnd) {
  const start = S.toTimestamp(appointment && appointment.startTime)
  const end = S.resolveEndTime(appointment)
  if (isNaN(start) || isNaN(end)) return false
  return start < dayEnd && end > dayStart
}

/* ------------------------------------------------------------------ */
/* board                                                              */
/* ------------------------------------------------------------------ */

async function actionBoard(event, auth) {
  const config = await loadConfig()
  const dayStart = event.date ? S.dayStartFromKey(event.date) : S.beijingDayStart(Date.now())
  if (isNaN(dayStart)) return fail(400, '日期格式应为 YYYY-MM-DD')
  const dayEnd = dayStart + S.DAY_MS
  const dateKey = S.dateKeyOf(dayStart)

  const techInfo = await loadTechnicians(auth.enterpriseId)

  // 多取前一天：跨天预约（18:00 干到次日 10:00）第二天必须继续出现在表上。
  // 单条最长 24 小时，所以往前推一天足够覆盖所有跨天情况。
  const apptRes = await db.collection(COLL.appointment).where({
    enterpriseId: auth.enterpriseId,
    startTime: dbCmd.gte(dayStart - S.DAY_MS).and(dbCmd.lt(dayEnd))
  }).orderBy('startTime', 'asc').limit(300).get()

  const appointments = (apptRes.data || []).filter(a => overlapsDay(a, dayStart, dayEnd))

  let goods = []
  try {
    const goodsRes = await db.collection(COLL.goods).where({ enterpriseId: auth.enterpriseId }).limit(300).get()
    goods = (goodsRes.data || []).map(g => ({
      _id: g._id,
      name: g.name,
      fee: toInt(g.fee, 0),
      duration: toInt(g.duration, config.slotMinutes)
    }))
  } catch (e) {
    goods = []
  }

  // 师傅重叠 + 工位重叠两类异常都标出来
  const pairs = S.detectConflictPairs(appointments).concat(S.detectBayConflictPairs(appointments))
  const conflictIds = []
  pairs.forEach(pair => {
    pair.forEach(id => {
      if (conflictIds.indexOf(id) < 0) conflictIds.push(id)
    })
  })

  const decorated = decorate(appointments, config, conflictIds, dayStart)
  const filtered = event.technicianId
    ? decorated.filter(a => a.technicianId === event.technicianId)
    : decorated

  const summary = S.summarize(appointments, Object.assign({
    technicianCount: techInfo.technicians.length,
    dayStart: dayStart
  }, config))
  summary.conflictPairs = pairs.length
  summary.conflictCount = conflictIds.length
  summary.bayCount = config.bayCount

  const bays = S.bayLoad(appointments, config, dayStart)
  summary.bayPeak = bays.peak
  summary.bayPeakLabel = bays.peakLabel
  summary.bayFullCount = bays.fullSlots.length
  summary.bayFullLabels = bays.fullLabels

  return ok({
    date: dateKey,
    dateLabel: S.dateLabel(dateKey),
    dayStart: dayStart,
    dayEnd: dayEnd,
    config: Object.assign({}, config, {
      openLabel: S.hhmm(config.openMinutes),
      closeLabel: S.hhmm(config.closeMinutes)
    }),
    slots: S.buildSlots(config),
    technicians: techInfo.technicians,
    hasTechnicianFlag: techInfo.hasTechnicianFlag,
    staffCount: techInfo.staffCount,
    appointments: filtered,
    goods: goods,
    bays: bays,
    summary: summary
  })
}

/* ------------------------------------------------------------------ */
/* save                                                              */
/* ------------------------------------------------------------------ */

async function actionSave(event, auth) {
  const config = await loadConfig()
  const editingId = event.id ? String(event.id) : ''

  const check = S.validateDraft(event, config)
  if (!check.ok) {
    return fail(400, check.errors.join('；'), { errors: check.errors })
  }
  const n = check.normalized

  // 师傅必须属于本门店，防止把单派到别家师傅名下
  let tech = null
  try {
    const techRes = await db.collection(COLL.user).doc(n.technicianId).get()
    tech = (techRes.data || [])[0]
  } catch (e) {
    tech = null
  }
  if (!tech || tech.enterpriseId !== auth.enterpriseId) {
    return fail(400, '所选师傅不属于当前门店')
  }
  if (!isEnabled(tech.status)) {
    return fail(400, '所选师傅账号已停用')
  }

  // 编辑：先确认归属，已开单的预约不允许改时间（避免与工单脱节）
  let existing = null
  if (editingId) {
    const res = await db.collection(COLL.appointment).doc(editingId).get()
    existing = (res.data || [])[0]
    if (!existing || existing.enterpriseId !== auth.enterpriseId) {
      return fail(404, '预约不存在或不属于当前门店')
    }
    const timeChanged = Number(existing.startTime) !== Number(n.startTime) ||
      S.resolveDuration(existing) !== n.duration
    if (existing.orderId && timeChanged) {
      return fail(409, '该预约已开单，改时间请先在工单中处理')
    }
  }

  // 前后各取一天，覆盖跨天预约与「相邻但不重叠」的边界情况
  const existRes = await db.collection(COLL.appointment).where({
    enterpriseId: auth.enterpriseId,
    technicianId: n.technicianId,
    startTime: dbCmd.gte(n.startTime - S.DAY_MS).and(dbCmd.lt(n.startTime + S.DAY_MS))
  }).limit(200).get()

  const conflicts = S.findConflicts(existRes.data || [], {
    technicianId: n.technicianId,
    startTime: n.startTime,
    endTime: n.endTime,
    excludeId: editingId || undefined
  })
  if (conflicts.length) {
    return fail(409, '该时段师傅已有预约：' + conflicts.map(c => S.timeRangeText(c) + ' ' + (c.customerName || '客户')).join('、'), {
      conflicts: conflicts.map(c => ({
        _id: c._id,
        timeRangeText: S.timeRangeText(c),
        customerName: c.customerName || '',
        items: c.items || []
      }))
    })
  }

  // 工位容量：与「师傅冲突」是两回事，必须按全店取数而不是只看这位师傅。
  // 门店只有 3 个举升机时，3 位师傅可以同时接单，第 4 单就得排队。
  const bayRes = await db.collection(COLL.appointment).where({
    enterpriseId: auth.enterpriseId,
    startTime: dbCmd.gte(n.startTime - S.DAY_MS).and(dbCmd.lt(n.endTime + S.DAY_MS))
  }).limit(300).get()

  const bayPlan = S.bayPlan(bayRes.data || [], {
    startTime: n.startTime,
    endTime: n.endTime,
    excludeId: editingId || undefined
  }, config)

  if (bayPlan.full) {
    return fail(409,
      '该时段 ' + bayPlan.bayCount + ' 个工位都已占用：' +
      bayPlan.items.map(c => S.timeRangeText(c) + ' ' + (c.customerName || '客户')).join('、') +
      '，请改约其他时间', {
        bayFull: true,
        bayCount: bayPlan.bayCount,
        conflicts: bayPlan.items.map(c => ({
          _id: c._id,
          timeRangeText: S.timeRangeText(c),
          customerName: c.customerName || '',
          bayNo: parseInt(c.bayNo, 10) || 0
        }))
      })
  }

  // 指定了工位且仍空着就尊重手工指定，否则自动补空位
  let bayNo = 0
  if (bayPlan.limited) {
    const wanted = toInt(event.bayNo, 0)
    bayNo = bayPlan.freeBays.indexOf(wanted) > -1 ? wanted : bayPlan.suggestedBay
  }

  // 车辆信息用于补齐车牌/车主，避免前台重复填写
  let car = null
  if (n.carInfoId) {
    try {
      const carRes = await db.collection(COLL.car).doc(n.carInfoId).get()
      car = (carRes.data || [])[0]
    } catch (e) {
      car = null
    }
    if (car && car.enterpriseId && car.enterpriseId !== auth.enterpriseId) {
      return fail(400, '所选车辆不属于当前门店')
    }
  }

  const items = (Array.isArray(event.items) ? event.items : []).map(it => ({
    goodsId: String((it && it.goodsId) || ''),
    name: String((it && it.name) || '').trim(),
    fee: toInt(it && it.fee, 0),
    duration: toInt(it && it.duration, config.slotMinutes)
  })).filter(it => it.name)

  const now = Date.now()

  // 只传了会员 ID 没传姓名时，从会员档案补名字和电话，避免看板上出现「未填客户」
  let member = null
  if (!n.customerName && n.memberId) {
    try {
      const memberRes = await db.collection(COLL.member).doc(n.memberId).get()
      member = (memberRes.data || [])[0]
    } catch (e) {
      member = null
    }
    if (member && member.enterpriseId !== auth.enterpriseId) member = null
  }

  const doc = {
    technicianId: n.technicianId,
    technicianName: tech.realName || tech.username || '未命名',
    memberId: n.memberId || '',
    carInfoId: n.carInfoId || '',
    carNumber: String(event.carNumber || (car && car.carNumber) || '').trim(),
    customerName: n.customerName || String((car && car.owner) || (member && member.name) || '').trim(),
    customerPhone: String(event.customerPhone || (car && car.ownerphone) || (member && member.phone) || '').trim(),
    items: items,
    startTime: n.startTime,
    endTime: n.endTime,
    duration: n.duration,
    bayNo: bayNo,
    remark: String(event.remark || '').trim(),
    updateTime: now
  }

  let id = editingId
  if (editingId) {
    await db.collection(COLL.appointment).doc(editingId).update(doc)
  } else {
    doc.enterpriseId = auth.enterpriseId
    doc.status = S.STATUS.BOOKED
    doc.orderId = ''
    doc.createUserId = auth.userId
    doc.createUserName = auth.user.realName || auth.user.username || ''
    doc.createTime = now
    const res = await db.collection(COLL.appointment).add(doc)
    id = res.id
  }

  return ok({
    _id: id,
    warnings: check.warnings,
    startTime: doc.startTime,
    endTime: doc.endTime,
    duration: doc.duration,
    bayNo: doc.bayNo
  })
}

/* ------------------------------------------------------------------ */
/* detail                                                            */
/* ------------------------------------------------------------------ */

async function actionDetail(event, auth) {
  const id = String(event.id || '')
  if (!id) return fail(400, '缺少预约ID')

  const res = await db.collection(COLL.appointment).doc(id).get()
  const appt = (res.data || [])[0]
  if (!appt || appt.enterpriseId !== auth.enterpriseId) {
    return fail(404, '预约不存在或不属于当前门店')
  }

  const config = await loadConfig()
  const dayStart = S.beijingDayStart(appt.startTime)
  const dayEnd = dayStart + S.DAY_MS

  // 同师傅当天（含跨天残留）的其他预约，用于判断改约空间
  const sameRes = await db.collection(COLL.appointment).where({
    enterpriseId: auth.enterpriseId,
    technicianId: appt.technicianId,
    startTime: dbCmd.gte(dayStart - S.DAY_MS).and(dbCmd.lt(dayEnd + S.DAY_MS))
  }).orderBy('startTime', 'asc').limit(100).get()
  const sameDay = (sameRes.data || []).filter(a => a._id === id || overlapsDay(a, dayStart, dayEnd))

  const pairs = S.detectConflictPairs(sameDay).concat(S.detectBayConflictPairs(sameDay))
  const conflictIds = []
  pairs.forEach(pair => pair.forEach(pid => {
    if (conflictIds.indexOf(pid) < 0) conflictIds.push(pid)
  }))

  const decorated = decorate([appt], config, conflictIds, dayStart)
  const others = decorate(sameDay.filter(a => a._id !== id), config, conflictIds, dayStart)

  // 已开单的话把工单状态带回来，详情页可以直接跳过去
  let order = null
  if (appt.orderId) {
    try {
      const orderRes = await db.collection(COLL.order).doc(appt.orderId).get()
      const o = (orderRes.data || [])[0]
      if (o) order = { _id: o._id, status: Number(o.status) }
    } catch (e) {
      order = null
    }
  }

  return ok({
    appointment: decorated[0],
    others: others,
    order: order,
    bay: {
      bayNo: parseInt(appt.bayNo, 10) || 0,
      bayCount: config.bayCount,
      crossDay: S.crossesDay(appt),
      boardTimeText: S.boardTimeText(appt, dayStart)
    },
    config: Object.assign({}, config, {
      openLabel: S.hhmm(config.openMinutes),
      closeLabel: S.hhmm(config.closeMinutes)
    })
  })
}

/* ------------------------------------------------------------------ */
/* byMember —— 客户视角的预约记录                                     */
/* ------------------------------------------------------------------ */

async function actionByMember(event, auth) {
  const memberId = String(event.memberId || '')
  if (!memberId) return fail(400, '缺少会员ID')

  const limit = Math.min(50, Math.max(1, toInt(event.limit, 10)))
  const config = await loadConfig()

  // 按开始时间倒序取最近的 N 条：未来的预约时间戳最大，一定会落在结果里
  const res = await db.collection(COLL.appointment).where({
    enterpriseId: auth.enterpriseId,
    memberId: memberId
  }).orderBy('startTime', 'desc').limit(limit).get()

  const decorated = decorate(res.data || [], config, [])
  const now = Date.now()
  const isUpcoming = a =>
    (Number(a.status) === S.STATUS.BOOKED || Number(a.status) === S.STATUS.WORKING) &&
    Number(a.endTime || a.startTime) >= now

  const upcoming = decorated.filter(isUpcoming).sort((x, y) => Number(x.startTime) - Number(y.startTime))
  const upcomingIds = upcoming.map(a => a._id)
  const history = decorated.filter(a => upcomingIds.indexOf(a._id) < 0)

  return ok({
    upcoming: upcoming,
    history: history,
    total: decorated.length
  })
}

/* ------------------------------------------------------------------ */
/* status                                                            */
/* ------------------------------------------------------------------ */

async function actionStatus(event, auth) {
  const id = String(event.id || '')
  const target = toInt(event.status, -1)
  if (!id) return fail(400, '缺少预约ID')
  if ([0, 1, 2, 3, 4].indexOf(target) < 0) return fail(400, '不支持的预约状态')

  const res = await db.collection(COLL.appointment).doc(id).get()
  const appt = (res.data || [])[0]
  if (!appt || appt.enterpriseId !== auth.enterpriseId) {
    return fail(404, '预约不存在或不属于当前门店')
  }

  // 已开单的预约取消，会让工单变成孤儿单，交回工单流程处理
  if (target === S.STATUS.CANCELLED && appt.orderId) {
    return fail(409, '该预约已开单，请先在工单中处理后再取消预约')
  }

  const patch = { status: target, updateTime: Date.now() }
  const remark = String(event.remark || '').trim()
  if (remark) patch.remark = remark
  await db.collection(COLL.appointment).doc(id).update(patch)

  return ok({ _id: id, status: target, statusText: S.statusText(target) })
}

/* ------------------------------------------------------------------ */
/* toOrder                                                           */
/* ------------------------------------------------------------------ */

async function actionToOrder(event, auth) {
  const id = String(event.id || '')
  if (!id) return fail(400, '缺少预约ID')

  const res = await db.collection(COLL.appointment).doc(id).get()
  const appt = (res.data || [])[0]
  if (!appt || appt.enterpriseId !== auth.enterpriseId) {
    return fail(404, '预约不存在或不属于当前门店')
  }
  if (Number(appt.status) === S.STATUS.CANCELLED) {
    return fail(400, '预约已取消，无法开单')
  }
  // 幂等：重复点「开单」直接回已有工单，不重复建单
  if (appt.orderId) {
    return ok({ orderId: appt.orderId, existing: true })
  }
  if (!appt.carInfoId) {
    return fail(409, '该预约还没有关联车辆，请先到「消费开单」选择车辆建单', { needCar: true })
  }

  const now = Date.now()
  const orderRes = await db.collection(COLL.order).add({
    userId: auth.userId,
    enterpriseId: auth.enterpriseId,
    memberId: appt.memberId || '',
    carInfoId: appt.carInfoId,
    time: now,
    updateTime: now,
    status: 0
  })
  const orderId = orderRes.id

  const items = Array.isArray(appt.items) ? appt.items.filter(it => it && it.name) : []
  if (items.length) {
    await db.collection(COLL.purchased).add(items.map(it => ({
      userId: auth.userId,
      enterpriseId: auth.enterpriseId,
      name: it.name,
      fee: toInt(it.fee, 0),
      count: 1,
      orderId: orderId,
      carId: appt.carInfoId,
      status: 0,
      source: 'goods'
    })))
  }

  await db.collection(COLL.appointment).doc(id).update({
    status: S.STATUS.WORKING,
    orderId: orderId,
    updateTime: now
  })

  return ok({ orderId: orderId, itemCount: items.length })
}

/* ------------------------------------------------------------------ */
/* setTechnician                                                     */
/* ------------------------------------------------------------------ */

async function actionSetTechnician(event, auth) {
  const value = event.value !== false
  const ids = Array.isArray(event.userIds) ? event.userIds.filter(Boolean) : []

  const where = { enterpriseId: auth.enterpriseId }
  if (ids.length) where._id = dbCmd.in(ids)

  const res = await db.collection(COLL.user).where(where).update({ canBeTechnician: value })
  return ok({ updated: (res && res.updated) || 0, value: value })
}

/* ------------------------------------------------------------------ */

const HANDLERS = {
  board: actionBoard,
  detail: actionDetail,
  byMember: actionByMember,
  save: actionSave,
  status: actionStatus,
  toOrder: actionToOrder,
  setTechnician: actionSetTechnician
}

exports.main = async (event) => {
  const action = String((event && event.action) || 'board')
  const handler = HANDLERS[action]
  if (!handler) {
    return fail(400, '未知操作：' + action)
  }
  try {
    const auth = await getOperator(event)
    if (auth.error) return auth.error
    return await handler(event || {}, auth)
  } catch (e) {
    console.error('[appointment_api] ' + action + ' 失败', e)
    return fail(500, '操作失败：' + ((e && e.message) || '未知错误'))
  }
}
