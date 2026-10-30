/**
 * 本地 mock 开关
 *
 * 默认关闭：提交到仓库、发行包、其他同事拉取后都走真实 uniCloud API。
 * 本地无云调试时，仅在本机把它改成 true，调试完改回 false，不要提交这个改动。
 */
export const USE_MOCK = false
