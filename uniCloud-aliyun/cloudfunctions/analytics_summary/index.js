'use strict'

/**
 * analytics_summary —— 经营数据只读统计（草案）
 *
 * ⚠️ 部署限制（重要）
 * 本函数**不得部署到共享 / 正式云空间**。原因：当前项目没有可信的身份认证机制。
 * 已核实：全项目没有 uni-id token、没有会话、没有签名；login 云函数是明文密码比对，
 * 登录结果直接存在客户端本地缓存，之后所有云函数都靠客户端传 userId / enterpriseId 判断身份。
 * 这意味着任何拿到 App 的人都能伪造 userId 读到别家门店的经营数据。
 *
 * 因此本函数采用 fail-closed：除非在云函数环境变量里显式设置
 *     ANALYTICS_TRUSTED_AUTH = on
 * 否则一律返回 403，绝不返回任何统计数据。
 *
 * 上线前必须完成的改造（属于团队公共架构，不在本模块内擅自修改）：
 * 1. 接入 uni-id 登录态，函数内用 token 解析出 uid，禁止再信任 event.userId；
 * 2. 由服务端根据 uid 反查 enterpriseId（本函数已经这么做，但 uid 本身要可信）；
 * 3. 在 uniCloud 控制台为 order 建复合索引 (enterpriseId, status, updateTime)。
 *
 * 入参：{ userId, range }   range 仅支持 7 / 30 / 90
 * 出参：{ code, status, data: { summary, daily, payTypes, range, startDate, endDate } }
 *
 * 本函数只读：全程只有 aggregate，没有任何写操作。
 */

const db = uniCloud.database()
const dbCmd = db.command
const $ = db.command.aggregate

const { DAY_MS, BEIJING_OFFSET_MS, resolveRange } = require('./lib/day-bucket.js')
const { buildResult } = require('./lib/fold.js')

const ALLOWED_RANGES = [7, 30, 90]
const ORDER_STATUS_PAID = 2

// status 历史上可能被写成数字或字符串，两种都匹配，避免漏单
const PAID_STATUS_MATCH = dbCmd.in([ORDER_STATUS_PAID, String(ORDER_STATUS_PAID)])

// 数据源映射：test 读隔离测试集合，real 读正式业务表。
// 两套集合字段结构完全一致，所以聚合管道可以原样复用。
const SOURCE_COLLECTIONS = {
	test: { order: 'analytics_test_order', pay: 'analytics_test_pay_info' },
	real: { order: 'order', pay: 'pay_infos' }
}
const DEFAULT_SOURCE = 'real'

exports.main = async (event) => {
  const startedAt = Date.now()

  try {
    /* ---------------- 0. 可信认证闸门（fail-closed） ---------------- */
    if (process.env.ANALYTICS_TRUSTED_AUTH !== 'on') {
      console.warn('[analytics_summary] 拒绝调用：ANALYTICS_TRUSTED_AUTH 未开启')
      return {
        code: 403,
        status: 'error',
        message: '统计接口未启用可信认证，已拒绝访问（防止跨门店越权读取经营数据）'
      }
    }

    /* ---------------- 1. 参数校验 ---------------- */
    const range = Number(event && event.range)
    if (ALLOWED_RANGES.indexOf(range) < 0) {
      return { code: 400, status: 'error', message: 'range 仅支持 7 / 30 / 90' }
    }

    const userId = typeof (event && event.userId) === 'string' ? event.userId.trim() : ''
    if (!userId) {
      return { code: 401, status: 'error', message: '缺少 userId，无法校验门店权限' }
    }

    const source = typeof (event && event.source) === 'string' ? event.source : DEFAULT_SOURCE
    if (!SOURCE_COLLECTIONS[source]) {
      return { code: 400, status: 'error', message: 'source 仅支持 real / test' }
    }
    const cols = SOURCE_COLLECTIONS[source]

    /* ---------------- 2. 服务端解析门店（忽略客户端传的 enterpriseId） ---------------- */
    const userRes = await db.collection('user').doc(userId).get()
    const user = userRes.data && userRes.data[0]
    if (!user) {
      return { code: 401, status: 'error', message: '用户不存在' }
    }
    const userStatus = user.status
    if (userStatus === false || userStatus === 0 || userStatus === '0') {
      return { code: 403, status: 'error', message: '账号已停用' }
    }
    const enterpriseId = user.enterpriseId
    if (!enterpriseId) {
      return { code: 403, status: 'error', message: '该账号未绑定门店' }
    }

    /* ---------------- 3. 计算北京时间自然日区间（左闭右开） ---------------- */
    const rangeInfo = resolveRange(range, Date.now())

    /* ---------------- 4. 一次聚合：订单维度（工单数） ----------------
     * 只查 order 表，不 join pay_infos。
     * 这样「没有付款记录的已入账订单」照样被计数，
     * 也天然不会因为「一单多笔付款」被重复计数。
     */
    const orderAgg = await db
      .collection(cols.order)
      .aggregate()
      .match({
        enterpriseId: enterpriseId,
        status: PAID_STATUS_MATCH,
        updateTime: dbCmd.gte(rangeInfo.startTime).and(dbCmd.lt(rangeInfo.endTime))
      })
      .group({
        _id: $.floor($.divide([$.add(['$updateTime', BEIJING_OFFSET_MS]), DAY_MS])),
        orders: $.sum(1)
      })
      .end()

    /* ---------------- 5. 一次聚合：付款维度（金额 + 收款方式） ----------------
     * 从 pay_infos 出发 join order，用 order 的 status / updateTime 做过滤，
     * 保证「按订单结算日归集金额」的口径与工单数完全一致。
     * fees 用 push 收集原始值而不是直接 sum：历史 fee 可能是字符串，
     * $sum 遇到非数字会静默当 0，宁可回到云函数里做安全转换。
     */
    const payAgg = await db
      .collection(cols.pay)
      .aggregate()
      .match({ enterpriseId: enterpriseId })
      .lookup({
        from: cols.order,
        localField: 'orderId',
        foreignField: '_id',
        as: 'orderInfo'
      })
      .unwind('$orderInfo')
      .match({
        'orderInfo.status': PAID_STATUS_MATCH,
        'orderInfo.updateTime': dbCmd.gte(rangeInfo.startTime).and(dbCmd.lt(rangeInfo.endTime))
      })
      .group({
        _id: {
          day: $.floor($.divide([$.add(['$orderInfo.updateTime', BEIJING_OFFSET_MS]), DAY_MS])),
          type: '$type'
        },
        fees: $.push('$fee')
      })
      .end()

    /* ---------------- 6. 折叠成页面结构 ---------------- */
    const result = buildResult(orderAgg.data || [], payAgg.data || [], {
      firstIdx: rangeInfo.firstIdx,
      days: range
    })

    return {
      code: 200,
      status: 'success',
      data: {
        range: range,
        source: source,
        startDate: rangeInfo.startDate,
        endDate: rangeInfo.endDate,
        generatedAt: Date.now(),
        costMs: Date.now() - startedAt,
        summary: result.summary,
        daily: result.daily,
        payTypes: result.payTypes
      }
    }
  } catch (e) {
    console.error('[analytics_summary] 执行异常', e)
    return {
      code: 500,
      status: 'error',
      message: '统计失败：' + ((e && e.message) || '未知错误')
    }
  }
}
