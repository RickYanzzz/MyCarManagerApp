# 经营统计模块 · 数据接口说明

> 适用分支：`feature/business-analytics`
> 涉及云函数：`analytics_summary`（只读统计）、`analytics_test_data`（隔离测试数据 CRUD）

---

## 一、集合与字段结构

⚠️ 先看这一条：**项目里的 `*.schema.json` 不能当字段字典用**。
`order.schema.json` 只声明了 6 个字段、`purchased_goods.schema.json` 只有一个 `_id`、`todays_income.schema.json` 是空壳。
原因是所有读写都走云函数，**云函数不受 schema 校验约束**，实际文档字段比 schema 多得多。
下表是按云函数的实际写入代码反推出来的真实结构。

### 1. `order` 订单（统计主表）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `_id` | string | 系统 | 主键 |
| `userId` | string | 是 | 操作人 |
| `enterpriseId` | string | 是 | 门店 |
| `carInfoId` | string | 是 | 车辆 |
| `time` | number | 是 | **下单时间**，毫秒时间戳，写入后不变 |
| `updateTime` | number | 是 | **最后一次状态变更时间**，毫秒时间戳，会被覆盖 |
| `status` | int | 是 | `-1` 已删除 / `0` 临时·施工中 / `1` 挂帐 / `2` 已入账 |

> 订单本身**没有金额字段**，金额只存在于 `pay_infos`。

### 2. `pay_infos` 收款记录

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `_id` | string | 系统 | 主键 |
| `userId` / `enterpriseId` | string | 是 | 归属 |
| `orderId` | string | 是 | 关联订单 |
| `carId` | string | 是 | 关联车辆 |
| `name` | string | 是 | 付款方式中文名（可自由填写，**不要用它做分组**） |
| `type` | int | 是 | `1`微信 `2`现金 `3`支付宝 `4`赠送 `5`其他 `6`银行卡 |
| `fee` | int | 是 | 金额，**单位：元**。历史数据里可能是字符串 |

> **没有时间字段**。所以「按付款时间统计」做不到，只能用订单的 `updateTime` 近似。

### 3. `purchased_goods` 消费明细

`_id` / `userId` / `enterpriseId` / `name` / `fee` / `count` / `orderId` / `carId` / `status`

### 4. `goods` 项目·套餐库

`_id` / `name` / `fee`(int 元) / `hotStatus`(bool) / `enterpriseId`

### 5. `car_info` 车辆

`_id` / `userId` / `enterpriseId` / `carNumber` / `type`(`0` 临牌 / `1` 车牌)

### 6. `user` 用户

`_id` / `realName` / `phoneNumber` / `enterpriseId` / `password` / `username` / `status`

### 7. `enterprise` 门店

`_id` / `name` / `address` / `receipt` / `phone`

### 8. `todays_income`

schema 是空壳，没有对应的写入代码，**当前未被使用**。

### 9. 隔离测试集合（本模块新增，仅测试用）

| 集合 | 字段 |
|---|---|
| `analytics_test_order` | 与 `order` 同结构，额外带 `__test: true` |
| `analytics_test_pay_info` | 与 `pay_infos` 同结构，额外带 `__test: true` |

字段结构故意保持与正式表一致，这样同一套聚合管道可以原样复用。

---

## 二、数据源切换

前端只有一个开关文件：`common/js/analytics-config.js`

```js
export default {
  useMock: true,     // true=本地模拟数据，false=真实调用云函数
  source: 'test'     // 仅 useMock=false 时生效：'test' 隔离测试集合 / 'real' 正式表
}
```

建议顺序：`useMock=false` + `source='test'` → 跑通链路、核对数字 → 再切 `source='real'`。

---

## 三、接口清单与调用方式

前端统一挂在 `this.$api`（见 `common/api/index.js`）。

### 3.1 统计查询（只读）

```js
this.$api.get_analytics_summary({ range: 30, source: 'test' })
  .then(res => res.data)   // { range, source, startDate, endDate, summary, daily, payTypes }
  .catch(err => err.message)
```

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `range` | Number | 是 | 仅支持 `7` / `30` / `90` |
| `source` | String | 否 | `real`（默认）/ `test` |
| `userId` | String | 由封装自动注入 | 从本地登录缓存读取 |

返回 `data`：

```js
{
  range: 30,
  source: 'test',
  startDate: '2026-09-29',
  endDate: '2026-10-28',
  summary: {
    totalAmount: 71031.26,   // 已入账订单金额（已剔除赠送）
    totalOrders: 139,        // 已入账工单数
    avgPerOrder: 511.02,     // 平均每单
    giftAmount: 2130.09,     // 赠送金额，不计入 totalAmount
    payTypeCount: 5
  },
  daily: [ { date: '2026-09-29', amount: 0, orders: 0 }, ... ],  // 区间内每天都有，缺数据补 0
  payTypes: [ { type: 1, label: '微信', amount: 36936.25, count: 72, isGift: false }, ... ]
}
```

### 3.2 测试数据 CRUD

```js
this.$api.seed_analytics_test_data(30)                 // 造 30 天数据
this.$api.list_analytics_test_data(1, 20)              // 分页查
this.$api.create_analytics_test_data({
  status: 2,
  updateTime: Date.now(),
  pays: [ { type: 1, fee: 300 }, { type: 4, fee: 50 } ]
})
this.$api.update_analytics_test_data(id, { status: 2, updateTime: Date.now() })
this.$api.remove_analytics_test_data(id)
this.$api.clear_analytics_test_data()
```

底层是同一个云函数 `analytics_test_data`，参数约定：

| action | 参数 | 说明 |
|---|---|---|
| `seed` | `days` 1~90 | 先清空再生成，含无单日、一单多笔、赠送等边界 |
| `list` | `page` ≥1、`pageSize` 1~50 | 按 `updateTime` 倒序，附带付款明细 |
| `create` | `status`、`updateTime`、`pays[]` | `pays` 每项 `{ type, fee, name? }` |
| `update` | `_id` + `status` / `updateTime` | 只允许改这两个字段 |
| `remove` | `_id` | 同时删除其付款记录 |
| `clear` | 无 | 清空本门店全部测试数据 |

---

## 四、错误码与异常处理

所有接口统一返回 `{ code, status, message?, data? }`，前端封装会把失败归一成 `reject({ code, message })`。

| code | 含义 | 前端处理建议 |
|---|---|---|
| 200 | 成功 | — |
| 400 | 参数非法（range/source/action/_id 不对） | 提示参数错误，属于开发期问题 |
| 401 | 缺少 userId 或用户不存在 | 跳登录页 |
| 403 | 未启用（环境变量未开）/ 账号停用 / 未绑门店 | 提示「功能未开启」 |
| 404 | 测试记录不存在或不属于当前门店 | 提示并刷新列表 |
| 500 | 服务端异常（聚合失败、写库失败） | 提示可重试 |
| -1 | 云函数无返回 | 提示重试 |
| -2 | 网络/调用异常 | 封装已细分为「云函数未部署」「请求超时」，否则提示网络异常 |

**页面侧的异常处理**（`pages/analytics/analytics.vue` 已实现）：
- `status = 'loading'` → 骨架屏
- `status = 'error'` → 展示 `message` + 「重新加载」按钮
- `isEmpty` → 「该时间段暂无已入账订单」
- 下拉刷新失败也会 `stopPullDownRefresh`，不会卡住

**云函数侧**：所有动作都包在 `try/catch` 里，异常统一转 `500` 并打 `console.error`，不会把堆栈抛给客户端。

---

## 五、部署与开闸（必须由你在 HBuilderX 操作）

我这边**不能也不应该**代替你部署。步骤：

1. HBuilderX 已关联服务空间（你已完成）
2. 右键 `uniCloud-aliyun/cloudfunctions/analytics_summary` → **上传部署**
3. 右键 `analytics_test_data` → **上传部署**
4. 打开 uniCloud 控制台 → 云函数 → 对应函数 → 配置 → **环境变量**：
   - `analytics_summary`：`ANALYTICS_TRUSTED_AUTH = on`
   - `analytics_test_data`：`ANALYTICS_TEST_DATA_ENABLED = on`

   ⚠️ **实测坑**：阿里云版空间里，重新上传云函数后环境变量可能失效（云端配置被覆盖），
   函数读不到 `process.env`。所以两个云函数还支持**数据库开关**作为等价替代：

   1. 云数据库新建集合 `app_config`
   2. 添加记录（两条）：

   | key | value |
   |---|---|
   | `ANALYTICS_TRUSTED_AUTH` | `on` |
   | `ANALYTICS_TEST_DATA_ENABLED` | `on` |

   函数读取顺序是「环境变量 → app_config」，任一为 `on` 即视为开启。
   数据库方式的好处是**改一条记录就生效，不用重新部署函数**，也不会被上传覆盖。
5. 前端 `common/js/analytics-config.js` 改成 `useMock: false`
6. 先 `seed` 造数 → 看页面 → 数字对得上再切 `source: 'real'`

> 两个开关都是**默认关闭**：不设环境变量，云函数一律 403。这是防止误部署后被越权读取的兜底。

---

## 六、安全边界（务必先读）

当前项目**没有可信身份认证**：没有 token、登录是明文密码比对、`userId` 由客户端提供。这意味着只要知道别人的 `userId`，就能读到别人门店的数据。

因此：

- 本模块的接口**只能部署在你个人的测试空间**，不能上团队正式空间。
- 上线前必须接入 uni-id（token 解析 uid），并把 `event.userId` 全部替换为 token 里的 uid。
- 写接口（`analytics_test_data`）只写 `analytics_test_*` 隔离集合，代码里没有任何路径能写到 `order` / `pay_infos`，集合名还是常量白名单 + 前缀断言双重保护。

---

## 七、已知口径限制

1. **收入按订单结算日期归集，不是付款日期**（`pay_infos` 无时间字段）。
2. `updateTime` 是「最后一次状态变更时间」，挂帐、删除、改回未结算都会覆盖它，历史报表可能漂移。
3. **无退款概念**：没有退款字段、没有负金额约定；`delete_pay_info` 是物理删除，删完历史数字会变小且不可追溯。
4. **重复付款无法识别**：同一单误点两次就是两条记录，统计会全额累加。
5. `fee` 历史数据可能是字符串，聚合时用 `push` + JS 侧安全转换，不用 `$sum`（`$sum` 遇非数字会静默当 0）。
