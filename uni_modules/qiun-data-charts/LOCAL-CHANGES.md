# 本目录的本地改动说明（相对上游原包）

- 上游：https://gitee.com/uCharts/uCharts
- 包名/版本：`qiun-data-charts` 2.5.0-20230101
- 许可证：Apache License 2.0（见同目录 `license.md`，未修改）
- 版权：Copyright (c) 2021 QIUN® 秋云 https://www.ucharts.cn

## 改动内容

**删除了以下两个文件（其余文件与上游完全一致，未做任何修改）：**

| 文件 | 大小 | 说明 |
|---|---|---|
| `static/app-plus/echarts.min.js` | 747 KB | 仅在 `:echarts="true"` 且 App 端时由组件动态加载 |
| `static/h5/echarts.min.js` | 747 KB | 仅在 `:echarts="true"` 且 H5 端时由组件动态加载 |

## 删除原因

本项目只使用 uCharts 引擎渲染（不传 `echarts` 属性），两个 ECharts 文件都不会被加载。
但 uni_modules 下的 `static/` 目录会被完整打进小程序包：

- 保持原包：小程序主包由 0.92 MB 增至约 2.9 MB，**超过微信小程序主包 2 MB 上限**
- 裁剪后：增加约 0.55 MB，主包约 1.47 MB，留有余量

## 如果以后需要 ECharts 引擎

从上游重新下载这两个文件放回原路径即可，无需其它改动。
在此之前请不要在 `<qiun-data-charts>` 上使用 `:echarts="true"`，否则 App/H5 端会因脚本 404 而白屏。
