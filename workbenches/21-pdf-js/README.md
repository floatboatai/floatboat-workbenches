# PDF 阅读室 · PDF.js

基于 **pdfjs-dist 6.4.299** 的本地 PDF 阅读与审阅工作台。深色阅读区、紧凑页轨与独立页边笔记。

![PDF 阅读室](../../docs/screenshots/pdf-js.png)

- PDF.js worker 真实渲染与可选择文字层；缩略图、页码导航、缩放和跨页文本搜索。
- 每页笔记自动保存，恢复未提交的名称、搜索词和跳转输入；明确区分已保存、草稿、离线与冲突。
- 原 PDF 存入持久化文件资源，分块上传并校验 SHA-256。下载保持原始字节。
- 导出 `.pdfreview` 一并携带原文件、所有笔记和阅读位置；导入创建新项目。
- 包含自制的三页河岸观察示例，无外部文档请求或模型依赖。

支持最多 **12 MiB / 200 页**。笔记每页 12000 字、合计 120000 字；搜索每页前 200000 字的可提取文本，按页定位。扫描件无 OCR；密码保护文件需先解除密码；不支持 PDF 内容编辑、表单填写、签名验证、外链操作、XFA 或把笔记写回 PDF。超过 1600 万像素的图像受渲染预算限制。详见 [需求边界](app/REQUIREMENTS.md) 与 [工程说明](app/ENGINEERING.md)。

同浏览器同 origin 可恢复本机草稿；跨设备迁移使用便携项目。恢复草稿 JSON 保留未完成输入，但不能直接作为便携项目导入。项目删除保留共享 PDF 原文件，失败上传分块可能留存；此版没有自动资源清理。

## 安装与开发

在仓库根目录运行：

```sh
pnpm workbench prepare pdf-js
pnpm workbench check pdf-js
pnpm workbench test pdf-js
pnpm workbench dev pdf-js
pnpm workbench package pdf-js
```

导出的 `.fbworkbench` 是应用源码包，默认不含用户资料。在 Floatboat → 我的 → 工作台 → 导入工作台中安装。当前交付验证了本地 HTTP / SQLite / 文件资源与 Chrome；**Floatboat Desktop 导入未验证**。无 Host 或模型调用。

## 验证

7 项领域测试覆盖项目字节往返、损坏容器、模型边界、PDF 签名/容量、搜索、持久化原文件完整性、自动保存幂等/草稿/冲突。真实 Chrome 验收覆盖原生渲染与文字层、页码/缩放/检索、笔记刷新恢复、无效/加密 PDF、原文件与便携下载独立字节检查、导入新项目、延迟 ACK 期间输入、提交后丢失响应重试、未完成输入恢复、冲突恢复、375px 深色与 reduced-motion、可见焦点；离线新项目切换/同 origin 新页恢复/重连唯一保存，损坏 PDF、12 MiB 和 201 页边界拒绝。最终截图来自普通示例资料。

## 来源与许可

上游：[PDF.js source](https://github.com/mozilla/pdf.js)、[official examples](https://mozilla.github.io/pdf.js/examples/)、[npm package](https://www.npmjs.com/package/pdfjs-dist/v/6.4.299)。PDF.js 为 Apache-2.0；原许可证、字体许可证与 wasm 目录中的第三方通知随项目资源保留。详见 [第三方通知](THIRD_PARTY_NOTICES.md)。自制示例文件用于普通阅读演示。
