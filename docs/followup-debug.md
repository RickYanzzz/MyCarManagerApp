# AI 回访调试手册

> 面向：店主本人 / 自己在 HBuilderX 里跑通并验证 AI 回访。
> 结论先给：**回访功能不能在没有云空间的情况下调试**（要用数据库 + 大模型），H5 本地 mock 模式跑不了它。

---

## 一、先明确三个"必须"

| 必须 | 为什么 | 不做的表现 |
|---|---|---|
| 关联 uniCloud 阿里云服务空间 | 回访要读会员/车辆/订单/次卡，还要写任务与话术 | 一进页面就报错，或提示"请先登录" |
| 上传 5 张新表 schema | `member_card`、`member_card_item`、`followup_task`、`followup_script`、`followup_log` | `collection not exists` |
| 部署 4 个回访云函数 + 1 个调试函数 | 业务逻辑都在云函数里 | `followup_scan is not a function` / 调用超时 |

另外：`common/mock/config.js` 里的 `USE_MOCK` 必须是 **false**，mock 里没有回访接口。这一项已经帮你改成 false 了。

---

## 二、部署（10 分钟，一次性）

1. **关联云空间**
   HBuilderX 打开项目 → 右键 `uniCloud-aliyun` 目录 → 「关联云服务空间」→ 选阿里云空间。
   没有空间就在 [uniCloud 控制台](https://unicloud.dcloud.net.cn/) 免费创建一个。

2. **上传数据库 schema**
   右键 `uniCloud-aliyun/database` → 「上传所有 DB Schema 及扩展校验函数」。
   本批新增/改动：`member_card`、`member_card_item`、`followup_task`、`followup_script`、`followup_log`、`member`、`goods`、`purchased_goods`。

3. **部署云函数**
   依次右键上传并部署：
   - `followup_scan`（带每天 08:00 定时触发器）
   - `followup_generate`（生成话术）
   - `followup_list`（工作台列表）
   - `followup_mark`（发送/忽略）
   - `followup_debug`（**调试用，本次新增**）
   - 会员次卡：`add_member_card`、`get_member_cards`

4. **（可选）配大模型 Key**
   阿里云百炼控制台 → API-KEY 管理 → 创建 Key。
   路径：uniCloud 控制台 → 云函数 → `followup_generate` → 「环境变量」→ 添加
   - `DASHSCOPE_API_KEY` = 你的 Key
   - `FOLLOWUP_MODEL` = `qwen-plus`（可不填，默认就是它）

   **不配也能跑**：话术自动走模板，页面会标"模板生成"，功能不会坏。

---

## 三、三档调试法（从底层到页面）

### 档位 1：直接调云函数（最快定位是数据问题还是代码问题）

HBuilderX 右键 `followup_debug` → 「上传并运行」，参数：

```json
{ "userId": "你的 user 表 _id", "action": "diagnose" }
```

返回示例：

```json
{
  "counts": { "member": 12, "car": 9, "order": 34, "memberCardItem": 0, "followupTask": 0 },
  "model": { "hasKey": false, "model": "qwen-plus" },
  "rules": [
    { "code": "R1", "label": "保险到期", "eligible": 2, "blocked": { "保险到期还早（>30 天）": 7 } },
    { "code": "R2", "label": "流失挽回", "eligible": 1, "blocked": { "该会员没有关联订单（订单没写 memberId）": 8 } }
  ],
  "hints": ["次卡表为空：去会员详情开一张次卡，剩余次数改到 1、lastUsedAt 改到 60 天前"]
}
```

这就是**"为什么没有人"的答案**：每条规则可触发几个、被什么条件挡掉几个。

### 档位 2：造一套能命中的测试数据

```json
{ "userId": "你的 user 表 _id", "action": "seed" }
```

会造 **4 个客户，每个只命中一条规则**（因为扫描有"同一客户 30 天内最多 2 条"的防骚扰上限，一个客户命中 4 条规则反而只能出 2 条任务，没法逐条验证）：

| 客户 | 命中的规则 | 造的依据 |
|---|---|---|
| 王丽（女，称呼会算成王姐） | R1 保险到期 | 车辆保险 20 天后到期 |
| 李强（男，李哥） | R2 流失挽回 | 2 笔入账订单，最后一笔 120 天前 |
| 张敏（女，张姐） | R3 余额闲置 | 卡里 800 元，300 天没到店 |
| 赵刚（男，赵哥） | R7 次卡余量 | 小保养剩 1 次，120 天未核销 |

扫一次应该 **新增 4 条任务**（已在本地用内存库跑过仿真验证：R1/R2/R3/R7 各 1 条，称呼分别是 王姐/李哥/张姐/赵哥）。验证完记得清理：

```json
{ "userId": "你的 user 表 _id", "action": "clear" }
```

> seed 的数据都带 `debugSeed: true` 标记，clear 只删这些，不碰你的真实数据。

### 档位 3：验证大模型通不通

```json
{ "userId": "你的 user 表 _id", "action": "test_model" }
```

返回 `{ ok: true, costMs: 800, reply: "收到" }` 说明 Key 和网络都正常。
返回 `未配置 DASHSCOPE_API_KEY` 就回去做第二步第 4 点。

### 档位 4：页面联调

运行到浏览器（或手机）→ 登录 → 首页「AI 回访」→ 点「刷新名单」。

- 有任务：卡片上出现称呼、规则标签、原因；点「生成话术」看正文
- **0 条：会自动弹出诊断面板**（本次新加），直接告诉你卡在哪

---

## 四、常见问题对照表

| 现象 | 原因 | 处理 |
|---|---|---|
| `xxx is not a function` | mock 开着，mock 里没有回访接口 | `common/mock/config.js` 改 `USE_MOCK = false` |
| 提示「请先登录」 | 没传 userId，或登录态缓存过期 | 退出重新登录；云函数参数里显式带 `userId` |
| 提示「账号未绑定门店」 | `user.enterpriseId` 为空 | 用店长账号登录，或补 `user.enterpriseId` |
| `集合不存在 / collection not exists` | schema 没上传 | 右键 database → 上传所有 schema |
| `permission denied` | 新表权限是 `read: false`（设计如此，只允许云函数访问） | 不要用 clientDB 直连，走 `$api.followup_*` |
| 扫描 `created: 0` | 规则阈值没满足 / 任务在冷却期 / 同一客户 30 天内已有 2 条 | 点空状态里的「诊断」看卡点；或先 seed |
| 话术显示"模板生成" | 没配 Key、Key 无效、或模型输出被三道闸拦 | 看卡片上的"已降级：xxx"；`test_model` 验 Key |
| 降级原因「数字不在事实卡内: 399」 | 模型编了金额，被防幻觉闸拦住 | **这是正常保护**，不是 bug；多点「换个说法」即可 |
| 定时扫描没触发 | 触发器要重新上传云函数才生效；时区按 UTC+8 | 先手动「刷新名单」，定时任务次日 08:00 再看 |
| 复制后微信没打开 | H5/小程序无法唤起微信 | App 端才支持 `plus.runtime.openURL('weixin://')`；H5 只复制 |

---

## 五、四条规则的触发条件（造数据时对照）

| 规则 | 触发条件 | 冷却 |
|---|---|---|
| R1 保险到期 | `car_info.insure` 在 0–30 天内 | 同客户 180 天 |
| R2 流失挽回 | 最近到店 > 90 天，且历史**入账**（status=2）订单 ≥ 2 单 | 同客户 90 天 |
| R3 余额闲置 | `member.balance` ≥ 200，且 90 天没到店 | 同客户 60 天 |
| R7 次卡余量 | 次卡权益剩余 ≤ 1 次，且 60 天未核销、未过期 | 同客户 45 天 |

同一客户 30 天内最多 2 条任务（防骚扰）。

---

## 六、上线前收尾

1. 用 `action: "clear"` 清掉测试数据
2. 确认真实数据下的扫描结果：先「诊断」，看各规则 eligible 是否符合预期，再决定是否调阈值（阈值在 `followup_scan/index.js` 顶部 `RULES`）
3. `followup_debug` 可以留着（它要求登录态、只操作本门店），但**不要**在页面上给客户暴露"造测试数据"的入口
4. 记得把 `common/mock/config.js` 保持 `USE_MOCK = false` 再提交

---

## 附录：纯本机调试（mock + 本地 AI 代理，2026-11-01 下午）

不连 uniCloud、不需要 DCloud 账号，整条回访链路都能在本机跑：

### 架构

```
App 页面 ──$api.followup_*──> common/mock/followup.js（localStorage 当数据库）
                                      │
                                      └─ 生成话术时 POST ──> scripts/local-ai-proxy.js（127.0.0.1:8787）
                                                                │ 配了 DASHSCOPE_API_KEY → 通义千问
                                                                └ 没配 / 没启动 → mock 自动降级模板话术
```

### 使用步骤

1. `common/mock/config.js` 里 `USE_MOCK = true`（当前已打开；**提交/打包前改回 false**）
2. HBuilderX 运行到浏览器，登录 `13800000000 / 123456`
3. 首页进「AI 回访」→ 点「刷新名单」→ 应出现 4 条任务（王丽-保险到期 / 李强-流失挽回 / 张敏-余额闲置 / 赵刚-次卡余量）
4. 想用真模型话术：启动本地代理
   ```bash
   # 方式一：环境变量
   DASHSCOPE_API_KEY=sk-xxx node scripts/local-ai-proxy.js
   # 方式二：把 Key 写进 scripts/local-ai-proxy.key（已 gitignore），直接 node 启动
   ```
   代理启动后点「生成话术」，卡片会标「AI 生成」；不启动就标「模板生成」，流程一样能走通。
5. 重置演示数据：工作台「诊断」→ 或调 `followup_debug({action:'clear'})` 后再 `seed`

### 自动化验证

```bash
node scripts/test-mock-followup.mjs
```

27 项断言：4 规则命中、称呼、冷却去重、优先级排序、三道闸（含编造数字/禁用词拦截）、缓存、状态流转、诊断、seed/clear 幂等。代理在线且配 Key 时会额外断言 `source = 'ai'`。

### 一致性约定

- 规则参数（R1/R2/R3/R7 的窗口、冷却、限频）在 `common/mock/followup.js` 与 `uniCloud-aliyun/cloudfunctions/followup_scan/index.js` 各有一份，**改了一边必须改另一边**。
- 话术 system prompt 同理：`scripts/local-ai-proxy.js` 与 `followup_generate/index.js` 保持一致。
- 三道闸（数字白名单/禁用词/长度）三处共用一套逻辑描述，mock 与线上行为已对齐（同一测试用例验证）。
