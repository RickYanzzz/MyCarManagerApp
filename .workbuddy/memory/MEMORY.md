# 项目长期备忘 — 智慧车店（MyCarManagerApp）

## 基本事实
- App 名称：智慧车店；appid `__UNI__98AA081`
- **微信小程序正式 AppID：`wx7c92f00cc06e5bfe`**（2026-10-21 已配置并成功上传 v1.0.3）
- 技术栈：uni-app + **Vue2**，HBuilderX 工程结构（无根 package.json）
- 后端：**uniCloud-aliyun**（阿里云），云函数在 `uniCloud-aliyun/cloudfunctions/`，数据库 schema 在 `uniCloud-aliyun/database/`
- 状态管理：Vuex（`store/index.js`）；API 封装：`common/api/`（统一 `uniCloud.callFunction`）
- 业务：消费开单 → 施工 → 结算；车辆管理；库存；报表；提醒

## 云与环境
- uniCloud 空间：名称 `mycarmanager`，spaceid `mp-8c6c06ab-8498-46a1-b7f6-f965529b6ffd`（阿里云，账号 335893166@qq.com）
- 运行目标：微信小程序（mp-weixin，用 touristappid）+ App（app-plus）
- HBuilderX 3.98；微信开发者工具已装并配置路径

## 约定 / 注意
- 项目用 HBuilderX 编译运行，不要引入 CLI/package.json 结构，以免破坏 HBuilderX 工程
- 修改后若编译异常，先在 HBuilderX「运行 → 运行到小程序模拟器/浏览器」并清缓存重试
- `pages/forms/forms.nvue`、`pages/more/more.nvue` 为 nvue 页面（App 专用）

## 第三方服务
- **车牌识别（百度 OCR）**：已改为**云函数代理** `ocr_license_plate`（前端不再持有 AK/SK）
  - 前端入口：`components/nav-header/nav-header.vue`（开单页相机图标）→ `this.$api.ocrLicensePlate(纯base64)`
  - API 封装：`common/api/image_ocr.js`（只导出 `ocrLicensePlate`）
  - 关键约束：百度要求 `image` 为**纯 base64（必须去掉 `data:image/xxx;base64,` 头）**；带前缀会返回 error_code 100
  - 云函数用 `uniCloud.httpclient.request` + `content: 'image=' + encodeURIComponent(base64)`，不要设 `contentType:'form'`（那是 multipart）
  - 阿里云 `callFunction` 的 event 上限 **2MB** → 前端压缩到「最长边 1600px + quality 60」并校验 base64 < 1.8MB
  - token 在云函数内做实例级缓存（提前 10 分钟过期）
  - 百度该接口有**每日调用额度**，用尽时返回 `error_code 17`（已映射为中文提示）
  - 已删除废弃云函数 `get_image_ocr_token`（无引用 + 会向调用方返回裸 token，有安全风险）；备份在 `/tmp/get_image_ocr_token_backup_20261013`

## 关键业务口径
- 「今日收入」= status=2（已入账）订单中，`pay_infoList` 里 `type != 4`（4=赠送）的 fee 之和
  - 依赖订单的 `updateTime`（订单完成时间）落在当天区间
  - 云函数 `get_order_byDate` 专供此功能
- 订单状态：0 临时/施工中，1 挂帐，2 已入账，-1 删除
- 付款方式 type：1 微信 2 现金 3 支付宝 4 赠送 5 其他 6 银行卡
- `delete_order` 云函数实际是「改状态」用（结束/挂帐/删除都走它），会写 status + updateTime
