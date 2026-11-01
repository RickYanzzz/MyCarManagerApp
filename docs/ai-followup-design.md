# AI 回访功能 · 可行性评估与设计方案

> 目标：店主打开 App/小程序 → 系统告诉他"今天该回访谁、为什么" → 一键生成个性化话术 → 转发给客户 → 记录结果、统计到店转化。

---

## 一、结论先说

把功能拆成 5 段看，可行度差别很大：

| 环节 | 可行度 | 说明 |
|---|---|---|
| ① 数据底座（订单/会员/车辆） | ✅ 可用 | 现有 13 张表基本够，7 条规则里有 4 条能直接跑 |
| ② 规则引擎（谁该回访、为什么） | ✅ 可行 | 但必须自己写规则，不能全靠大模型猜 |
| ③ AI 话术生成 | ✅ 可行 | 成本极低，风险在"幻觉"，需事实约束 |
| ④ 触达（发给客户） | ⚠️ 受限 | **微信没有"给指定客户发消息"的开放能力**，只能复制+跳转，人工点发送 |
| ⑤ 效果回收（到店转化） | ✅ 可行 | 回访后 N 天内是否产生入账订单，可直接算 |

**一句话结论**：功能整体可行，但"直接跳转微信发给客户"这一步做不到全自动。能做到的是「AI 生成 → 一键复制 → 拉起微信 → 店主粘贴发送」，把原本 2 分钟的措辞+打字压缩到 3 秒。如果想要真正自动发送，得走企业微信或短信通道。

---

## 二、现有数据盘点（决定能做什么）

### 2.1 已经能用的

| 数据 | 表 | 可用于什么回访 |
|---|---|---|
| 会员姓名/手机/等级/余额/累计充值/累计消费 | `member` | 称呼、消费分层、余额闲置提醒 |
| 车辆车牌/品牌/车主/电话/`insure`（保险到期） | `car_info` | 保险到期提醒（现成字段，最容易先做） |
| 工单状态/下单时间 | `order` | 上次到店时间、流失判定 |
| 消费明细（项目名/金额/数量/关联工单与车辆） | `purchased_goods` | 上次做了什么项目 |
| 收款记录（`pay_infos.fee`） | `pay_infos` | 客单价、大额消费回访 |
| 会员流水（类型/金额/时间） | `member_transactions` | 余额变动、卡使用频率 |

### 2.2 缺的，必须先补（否则话术会瞎编）

| 缺口 | 影响 | 补法 |
|---|---|---|
| `car_info` 无里程、无上次保养日期 | 无法判断"该保养了" | 加 `mileage`、`lastServiceDate` |
| `goods` 只有 `name/fee/hotStatus`，无分类、无周期 | 无法归类"保养/洗美/轮胎"，无法算复购周期 | 加 `category`、`cycleDays`、`cycleMileage` |
| `purchased_goods` **没有时间字段** | 只能靠 `orderId` join `order.time` 反推，成本高且易错 | 加 `createdAt`（历史数据按 order 回填一次） |
| 只有储值余额，**没有次数卡/套餐卡** | 你举的例子"卡里还有一次保养"目前数据不支持 | 新增 `member_card`、`member_card_item` 表 |
| 会员无生日、性别 | 生日关怀、称呼"姐/哥"只能猜 | 加 `birthday`、`gender` |
| 无营销授权字段 | 合规风险 | 加 `consentMarketing`、`consentAt` |

> 重要：`member.balance` 是**金额**，不是次数。要讲"还有一次保养"，必须先有次卡概念，否则只能改口径说"卡里还剩 380 元"。

---

## 三、微信触达能力矩阵（第 ④ 段为什么受限）

| 通道 | 能否指定某位客户 | 店主操作步数 | 成本 | 门槛 |
|---|---|---|---|---|
| 复制话术 + 打开微信手动发 | ✅ 能 | 2 步（粘贴、发送） | 0 | 无 |
| App 端 `uni.share` 分享到微信 | ⚠️ 只能分享，好友由用户手选 | 3 步 | 0 | 需 App 打包微信 SDK |
| 小程序订阅消息 | ❌ 不能（需客户 openid + 每次授权） | — | 0 | 客户得是小程序用户，门店场景基本没有 |
| 公众号订阅通知 | ⚠️ 仅关注并授权的客户 | 0 | 0 | 需引导扫码关注绑定 |
| 企业微信·外部联系人 | ✅ 能（客户是企微好友） | 0 | 低 | 企业认证 + 加好友 |
| 短信 | ✅ 能 | 0 | 约 4–5 分/条 | 签名报备 + 营销短信审核 |

**技术事实**：
- 微信开放平台没有"按手机号给某个人发消息"的 API，App 端 `plus.runtime.openURL('weixin://')` 只能打开微信聊天列表，**不能定位到具体联系人**。
- 小程序端更彻底：小程序内部无法唤起微信聊天窗口，只能写剪贴板。
- 因此"直接跳转微信"能省的是"打开发微信"这一步，省不掉"选人 + 发送"。

**推荐**：MVP 走「复制 + 拉起微信」；有企业微信的门店走企微自动发；短信作为高价值客户（如保险到期）兜底。

---

## 四、推荐方案总览

```
① 数据层       现有表 + 新增 5 个字段 / 3 张表
      ↓
② 规则引擎     followup_scan 云函数（每天 8:00 定时）
              输出 followup_task：客户 + 触发原因 + 事实卡
      ↓
③ 话术生成     followup_generate 云函数 → 通义/DeepSeek
              输入"事实卡"，输出结构化 JSON 话术
      ↓
④ 触达         回访工作台页：一键复制 → 拉起微信 / 短信 / 企微
      ↓
⑤ 闭环         followup_log 记录动作；30 天内到店 → 标记 converted
```

**核心设计原则：规则决定"说什么事实"，大模型只负责"怎么措辞"。**
反过来做（把原始数据丢给模型让它自己想）一定会编造权益、编造日期，门店发出去就出事。

---

## 五、规则引擎设计（8 条规则，标出数据就绪度）

| 编号 | 规则 | 触发条件 | 数据就绪 |
|---|---|---|---|
| R1 | 保险到期 | `car_info.insure` 距今 30 天内 | ✅ 现成 |
| R2 | 流失挽回 | 最近 `order.time` 距今 > 90 天，且历史入账单 ≥ 2 | ✅ 现成 |
| R3 | 余额闲置 | `member.balance` > 200 且 90 天无消费 | ✅ 现成 |
| R4 | 大额消费回访 | 入账金额 ≥ 800 且距今 3–7 天 | ✅ 现成（聚合 pay_infos） |
| R5 | 新客未复购 | 首次入账订单距今 30–45 天且仅 1 单 | ✅ 现成 |
| R6 | 保养到期 | 上次保养类项目距今 > `cycleDays` 或里程超 `cycleMileage` | ⚠️ 需补 goods 分类/周期 + 里程 |
| R7 | 次卡余量提醒 | `member_card` 剩余次数 ≤ 1 且 60 天未用 | ❌ 需新建次卡表 |
| R8 | 生日关怀 | `member.birthday` 未来 7 天内 | ❌ 需补字段 |

**优先级打分**：`score = 紧急度 × 客户价值`
- 紧急度：R1（到期）= 90，R7 = 85，R6 = 70，R2 = 60，R3 = 55，R4 = 40，R5 = 35，R8 = 30
- 客户价值：按 `totalConsume` 分位（近 12 个月消费额）

**限频**：同一客户 30 天内最多 2 条 AI 话术；同一规则 90 天内不重复触发。

**输出给 AI 的"事实卡"示例**（`factSnapshot`，只放这些，绝不放原始表）：

```json
{
  "customer": { "称呼": "王", "后缀": "姐", "等级": "金卡", "会员月龄": 14 },
  "car": { "品牌": "大众", "车型": "SUV", "车牌尾号": "8" },
  "history": { "上次到店": "2026-05-20", "距今天数": 165, "上次项目": "小保养", "累计到店": 6 },
  "trigger": { "规则": "R2", "原因": "165 天未到店", "可提的权益": "工时费 8 折（近 30 天有效）" },
  "store": { "名称": "XX 汽修", "地址": "…", "电话": "…" },
  "style": { "语气": "亲切简短", "长度": "80-110 字", "禁用词": ["最低价", "保证", "绝对"] }
}
```

---

## 六、话术生成设计

### 6.1 调用方式

云函数内直接 `uni-cloud` 发 HTTPS 到模型服务（推荐阿里云百炼/通义千问，与 uniCloud 阿里云同区域，延迟低、合规好；也可用 DeepSeek）。

```js
// uniCloud-aliyun/cloudfunctions/followup_generate/index.js（示意）
const system = `你是汽修门店的服务顾问，为店主写一条发给老客户的微信回访话术。
硬性规则：
1. 只能使用【事实卡】中出现的信息，禁止编造任何权益、日期、金额、项目。
2. 不承诺价格、不保证效果，不使用"最""保证""绝对"等词。
3. 80-110 字，口语化，称呼用"姓+姐/哥"，结尾给一个轻量的行动邀请。
4. 只输出 JSON：{"full_text":"","opening":"","reason":"","invite":"","risk_flags":[]}`

const user = JSON.stringify(fact)

// 输出示例
{
  "full_text": "王姐早上好，您的车上次小保养是 5 月 20 号，到现在快半年了，最近跑得多的话机油也该换一换了。这个月工时费打 8 折，您看这两天有空过来一趟不？",
  "opening": "王姐早上好",
  "reason": "距上次小保养 165 天",
  "invite": "这两天有空过来一趟不",
  "risk_flags": []
}
```

### 6.2 防幻觉（必做，三道闸）

1. **数字白名单校验**：话术里出现的所有数字（天数、金额、日期、折扣）必须能在 `factSnapshot` 里找到，否则判失败。
2. **禁用词正则**：`/最低|保证|绝对|第一|包治|永久/` 命中即降级。
3. **失败回退模板**：校验不通过 → 用规则自带模板填空，保证店主永远有话术可用。

### 6.3 稳定性策略

- 同客户同规则 7 天内复用缓存，不重复调模型
- 温度 0.7，`max_tokens` 300
- 批量生成走队列（一次最多 20 条），避免超时
- 话术里不出现客户手机号、车牌全号（脱敏）

---

## 七、数据模型改造

### 7.1 新增字段（schema 增量）

```json
// car_info.schema.json
"mileage":         { "bsonType": "int",  "title": "当前里程", "description": "公里" },
"lastServiceDate": { "bsonType": "timestamp", "title": "上次保养日期" },
"nextServiceMileage": { "bsonType": "int", "title": "下次保养里程" },

// goods.schema.json
"category":    { "bsonType": "string", "title": "项目分类", "enum": ["保养","洗美","轮胎","维修","钣喷","保险"] },
"cycleDays":   { "bsonType": "int", "title": "建议周期(天)" },
"cycleMileage":{ "bsonType": "int", "title": "建议周期(公里)" },

// purchased_goods.schema.json
"createdAt":   { "bsonType": "timestamp", "title": "消费时间" },

// member.schema.json
"birthday":        { "bsonType": "string", "title": "生日", "description": "MM-DD 或 YYYY-MM-DD" },
"gender":          { "bsonType": "int", "title": "性别", "enum": [0,1,2] },
"consentMarketing":{ "bsonType": "bool", "title": "同意接收服务提醒" },
"consentAt":       { "bsonType": "timestamp", "title": "授权时间" }
```

### 7.2 新增表

```json
// followup_task.schema.json
{
  "_id": "", "enterpriseId": "企业ID",
  "memberId": "会员ID", "carId": "车辆ID",
  "ruleCode": "R1..R8", "priority": "0-100",
  "reason": "触发原因文案",
  "factSnapshot": "object 事实卡快照",
  "status": "pending|generated|sent|converted|ignored",
  "dueDate": "建议联系日期", "createdAt": ""
}

// followup_script.schema.json
{ "taskId": "", "fullText": "", "model": "qwen-plus",
  "promptVersion": "v1", "riskFlags": [], "createdAt": "" }

// followup_log.schema.json
{ "taskId": "", "action": "copy|wechat|sms|wecom|call",
  "operatorUserId": "", "result": "sent|no_answer|rejected",
  "convertedOrderId": "", "createdAt": "" }

// member_card.schema.json（次卡/套餐卡）
{ "memberId": "", "enterpriseId": "", "cardName": "保养 3 次卡",
  "totalTimes": 3, "usedTimes": 1, "expireAt": "", "status": 1 }
```

> 历史数据回填：`purchased_goods.createdAt` 用 `orderId` join `order.time` 一次性刷；`goods.category` 用项目名关键词映射（含"保养/机油/机滤"→保养，"洗车/打蜡/内饰"→洗美，"轮胎/补胎"→轮胎），映射不准的留空，规则自然跳过。

---

## 八、云函数与接口清单

| 云函数 | 触发方式 | 职责 |
|---|---|---|
| `followup_scan` | 定时触发器（每天 08:00） | 跑 8 条规则，写入 `followup_task`，去重限频 |
| `followup_generate` | 前端调用 / 批量 | 取 task 事实卡 → 调模型 → 校验 → 存 `followup_script` |
| `followup_mark` | 前端调用 | 记录复制/发送/已到店，写 `followup_log` |
| `followup_stats` | 前端调用 | 回访数、响应率、30 天到店转化率 |
| `followup_convert` | 定时（每天 02:00） | 扫描 30 天内产生入账订单的客户，回写 `converted` |

前端 `common/api/followup.js` 按现有 `callFunction` 封装风格补齐即可。

---

## 九、前端交互（关键是"少一步"）

页面：`pages/followup/workbench.vue`（今日待回访）、`detail.vue`（客户画像 + 话术卡）、`settings.vue`（阈值/语气/门店签名）

话术卡底部两个按钮：**「复制并去微信」**、**「换个说法」**。

```js
// 复制 + 拉起微信（App 端）；小程序端只复制
copyAndGo(text) {
  uni.setClipboardData({
    data: text,
    success: () => {
      this.$api.followup_mark({ taskId: this.task._id, action: 'copy' })
      // #ifdef APP-PLUS
      plus.runtime.openURL('weixin://')   // 只能到聊天列表，无法定位联系人
      // #endif
      // #ifdef MP-WEIXIN
      uni.showModal({ title: '已复制', content: '去微信粘贴发送给客户', showCancel: false })
      // #endif
    }
  })
}
```

界面上要**明说**"已复制，请到微信粘贴"，不要让店主以为已经发出去了。发送后回来点「已发送」，形成记录。

---

## 十、合规与风控（别跳过，这块最容易踩坑）

1. **营销授权**：开卡表单加一个默认不勾选的"同意接收门店服务提醒"，存 `consentMarketing/consentAt`；没有授权的客户不出现在回访列表（或只允许电话邀约，不发营销文案）。
2. **退订机制**：话术末尾统一加"如需停止接收提醒，回复 TD"，收到 TD 置 `consentMarketing=false`。
3. **个人信息最小化**：调模型前脱敏——姓名只留姓、手机号打码、车牌只留尾号；`factSnapshot` 里不存完整手机号。
4. **第三方披露**：隐私政策补一段"为实现话术生成，可能与 XX 模型服务商共享脱敏后的订单与车辆信息"。
5. **频率与内容**：单客户 30 天 ≤ 2 条；禁用绝对化用语；不得虚构优惠。
6. **微信规则**：小程序内不得诱导分享、不得用"营销骚扰"话术；不要在话术里放外链。

---

## 十一、路线图

| 阶段 | 周期 | 交付 |
|---|---|---|
| **P0 MVP** | 1.5–2 周 | R1/R2/R3 三条规则 + `followup_task/script/log` 三张表 + 工作台页 + 复制跳微信 + 已发送记录 |
| **P1 数据补齐** | 2–3 周 | 补 `goods.category/cycleDays`、`purchased_goods.createdAt`、`car_info.mileage`；上线 R6 保养到期；批量生成；转化看板 |
| **P2 通道升级** | 3–4 周 | 企业微信外部联系人自动发送 / 短信兜底；A/B 话术；语音转文字记录通话要点 |

**P0 为什么能这么快**：R1（保险到期）字段现成、R2/R3 只需聚合现有表，不动业务逻辑，纯增量。

---

## 十二、成本

- 模型：单条话术约 600 in / 200 out tokens，成本在 **0.001–0.01 元** 量级。
- 1000 个客户/月：几元到几十元，可忽略。
- 主要成本是**开发工时**（P0 约 8–12 人日）和**数据清洗**（历史项目名归一化）。

---

## 十三、风险与开放问题

| 风险 | 应对 |
|---|---|
| 项目名是自由文本，历史数据难归类 | 先做关键词映射 + 人工确认清单，不追求 100% |
| 大模型编造权益 | 事实卡 + 数字白名单 + 禁用词三道闸，失败回退模板 |
| 店主觉得话术"太假" | 提供 3 种语气（亲切/专业/简短）+ 门店签名，收集采纳率迭代 prompt |
| 客户投诉骚扰 | 授权 + 限频 + 退订，三件套缺一不可 |
| 效果无法归因 | 用 `memberId/carId` 关联 30 天内入账订单，口径与经营统计保持一致 |

**待你决策**：
1. 是否接受"复制+跳微信"（人工点发送）作为一期形态？
2. 门店有没有企业微信？有的话 P2 可以直接上自动发送。
3. 是否愿意补次卡数据模型？不补的话"卡里还有一次保养"这类话术要换口径。

---

## 附录：P0 已落地的代码（2026-11-01）

### 新增数据表（5 张）

| 文件 | 说明 |
|---|---|
| `database/member_card.schema.json` | 次卡/套餐卡卡头：总次数、已用、剩余、有效期、售卡金额 |
| `database/member_card_item.schema.json` | 卡内项目权益：项目名、总/已用/剩余次数、最近核销时间 |
| `database/followup_task.schema.json` | 回访任务：规则、优先级、原因、事实卡快照、状态 |
| `database/followup_script.schema.json` | 生成的话术：正文、来源（ai/template）、风险标记 |
| `database/followup_log.schema.json` | 动作日志：复制/跳微信/电话/短信/已发送/忽略 |

`member.schema.json` 追加：`consentMarketing`、`consentAt`、`birthday`、`gender`。
> 兼容策略：`consentMarketing` 未显式设为 `false` 的会员都参与回访，避免上线后列表全空；后续可在会员详情加开关。

### 新增云函数（6 个）

| 云函数 | 触发 | 说明 |
|---|---|---|
| `followup_scan` | 定时 08:00 + 手动 | R1 保险到期 / R2 流失 / R3 余额闲置 / R7 次卡余量；含去重与限频（同规则冷却、单客户 30 天 ≤2 条） |
| `followup_generate` | 前端 | 调通义千问生成话术；三道闸（数字白名单 / 禁用词 / 长度）；不通过自动降级模板；7 天缓存 |
| `followup_list` | 前端 | 工作台列表，带最新话术 |
| `followup_mark` | 前端 | 记录动作并流转状态 |
| `add_member_card` | 前端 | 开次卡（卡头 + 权益明细） |
| `get_member_cards` | 前端 | 查询会员的次卡与明细 |

### 前端改动

- `common/api/followup.js`、`common/api/memberCard.js`，并在 `common/api/index.js` 注册
- 新增页面 `pages/followup/workbench.vue`（已注册 `pages.json`，首页「AI 回访」入口）
- `pages/member/detail.vue` 增加「次卡 / 套餐卡」区块与开卡弹窗

### 部署清单（必须在 HBuilderX 里操作）

1. 右键 `uniCloud-aliyun/database` → 上传所有 DB Schema 与扩展校验函数
2. 右键 6 个新云函数 → 上传部署（`followup_scan` 会带上定时触发器）
3. 配置模型密钥：阿里云百炼控制台拿 API Key，写进 `followup_generate` 云函数的环境变量 `DASHSCOPE_API_KEY`（可选 `FOLLOWUP_MODEL`，默认 `qwen-plus`）
   - **没配 Key 也能跑**：会自动走模板话术，`script.source = 'template'`
4. 打开 App → 首页「AI 回访」→ 点「刷新名单」验证

### P0 未覆盖（P1 再做）

- 次卡核销（开单时扣次数、写 `lastUsedAt`）
- `goods.category/cycleDays`、`car_info.mileage`，进而支持 R6 保养到期
- 回访转化自动回写（`convert` 定时任务）
- 批量生成、话术采纳率与转化看板

---

## 附录二：P1 第一批改动（2026-11-01 下午）

### 1. 保养/美容周期定版（按店主提供的《汽车保养 & 美容周期一览》截图）

- 标准唯一来源：`common/js/cycle-presets.js`（区间一律取下限，提醒宁早勿晚）
  - 保养类：机油三档（矿物油 180 天 / 半合成 240 天 / 全合成 365 天）、空调滤芯与空气滤芯 365 天、汽油滤芯 540 天、刹车油与防冻液 730 天、火花塞 730 天、轮胎 1095 天、蓄电池 540 天、刹车片 730 天、雨刮片 365 天
  - 洗美类：清洗打蜡 45 天、内饰桑拿洗 60 天、漆面划痕修复 60 天、全车镀晶 180 天、空调清洗 180 天
- `goods.schema.json` 新增：`category`（保养/洗美/轮胎/易损件/其他）、`cycleDays`、`cycleKm`、`cycleNote`
- 匹配规则：`matchCycleByName(项目名)` 按关键词匹配；半合成/矿物油在前，未注明油品类型的机油/小保养默认按全合成

### 2. 消费明细记录"什么时候做的项目"

- `purchased_goods.schema.json` 新增：`createdAt`（项目时间，timestamp）、`category` / `cycleDays` / `cycleName`（添加时的周期快照）
- `add_purchased_goods` 云函数：落库即写 `createdAt`（可显式传入修正）；写入周期快照
- 两个添加入口（热门项目 `clickTagPageItem`、自定义添加 `addConsumePro`）都按周期标准匹配后传快照
- 施工单明细行右侧显示 `金额 · MM-DD HH:mm`（`section-view` 组件）
- R6 保养到期规则的数据依据就此打通：按 `category + createdAt + cycleDays` 判断"上次保养距今是否超过周期"

### 3. 会员生日 / 性别

- `pages/member/add.vue`：新增性别选择（不填/男/女）与生日日期选择（选填）
- `add_member` / `update_member` 云函数：透传并校验 `gender`（0 未知/1 男/2 女）、`birthday`（YYYY-MM-DD 或 MM-DD）
- `pages/member/detail.vue`：信息区展示性别、生日
- 次卡功能为 P0 已落地（member_card 表 + 开卡弹窗 + 详情页展示），本轮确认链路完整

### 部署提醒

- 需重新上传 schema：`goods`、`purchased_goods`（`member` 上批已含 gender/birthday）
- 需重新部署云函数：`add_purchased_goods`、`add_member`、`update_member`
