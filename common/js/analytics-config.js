/**
 * 经营统计模块 · 数据源配置
 *
 * 改这里，不用改业务代码。两个开关含义：
 *
 * useMock
 *   true  → 用本地模拟数据，完全不访问云函数（默认，最安全）
 *   false → 真实调用云函数，读数据库
 *
 * source
 *   仅当 useMock = false 时生效，决定读哪一组集合：
 *   'test' → analytics_test_order / analytics_test_pay_info（隔离测试数据）
 *   'real' → order / pay_infos（真实经营数据）
 *
 * 建议流程：先 useMock=false + source='test'，用测试数据把链路跑通；
 * 确认统计数字对得上之后，再切 source='real'。
 *
 * 注意：真实调用需要云函数已在服务空间上传，且设置了环境变量
 *       ANALYTICS_TRUSTED_AUTH = on，否则云函数会返回 403。
 */
export default {
	useMock: true,
	source: 'test'
}
