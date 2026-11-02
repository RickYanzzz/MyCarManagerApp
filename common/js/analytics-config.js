/**
 * 经营统计模块 · 真实接口的数据源配置
 *
 * 只影响「走真实云函数」时的行为。本地 mock 不受这里控制——
 * mock 的总开关在 common/mock/config.js 的 USE_MOCK，与首页、订单列表共用同一个开关。
 *
 * source
 *   'real' → 聚合 order + pay_infos（真实经营数据）
 *   'test' → 聚合 analytics_test_order / analytics_test_pay_info（隔离测试数据）
 *
 * 建议流程：先用 test 源把链路跑通，确认数字对得上，再切 real。
 *
 * 注意：真实调用需要云函数已上传，且开关打开（环境变量或 app_config 集合里的
 *       ANALYTICS_TRUSTED_AUTH = on），否则云函数会返回 403。
 */
export default {
	source: 'real'
}
