/**
 * 本地 mock 开关
 *
 * true  = 全部接口走本机 mock（localStorage 模拟数据库），不连 uniCloud。
 *         登录用 13800000000 / 123456。
 *         AI 回访（followup_*）已支持 mock：自带 4 个演示客户（王丽/李强/张敏/赵刚），
 *         点「刷新名单」应扫出 4 条任务（R1/R2/R3/R7 各一）。
 * false = 全部接口走真实 uniCloud（发行包、联调真实数据时用）。
 *
 * 注意：提交 git、打包发行前务必改回 false。
 */

// 当前处于本机调试模式
export const USE_MOCK = false

/**
 * 本地 AI 代理地址（scripts/local-ai-proxy.js）。
 * mock 的 followup_generate 会先 POST 这个地址拿真实大模型话术；
 * 代理没启动时自动降级为模板话术，不影响流程调试。
 * 启动：set DASHSCOPE_API_KEY=sk-xxx && node scripts/local-ai-proxy.js
 * 或把 Key 写入 scripts/local-ai-proxy.key（已加入 .gitignore）
 */
export const FOLLOWUP_PROXY_URL = 'http://127.0.0.1:8787'
