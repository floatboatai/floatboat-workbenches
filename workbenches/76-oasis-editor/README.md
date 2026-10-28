# Oasis Editor 文稿室

版本 **0.8.0**。在连续纸张中编辑文稿、排版表格、核对图片和笔记，导出真正的 DOCX 与 PDF。原生 Canvas 编辑内核来自 [celsowm/oasis-editor](https://github.com/celsowm/oasis-editor)，使用 npm **0.0.195**，固定源提交 `ad0bd38f7ec7258ee2fb7a9f23fa7815a3d04195`。

![Oasis Editor 文稿室](../../docs/screenshots/oasis-editor.png)

实际支持正文输入、中文、加粗/斜体/下划线、字号、对齐、项目符号、表格插入、分页、撤销重做；纸张导航与缩放、校样笔记、DOCX 导入、DOCX/PDF 导出。分页与编辑由原生引擎完成。

正文未离焦、文稿名和笔记都自动保存。正式稿、未完成草稿、离线本机恢复、保存中和版本冲突分别显示。恢复稿下载包含原生模型、完整 OOXML 部件、内嵌图像、笔记、未完成字段及原件字节，可导入为独立新稿。原始 DOCX 另存为按 SHA-256 校验的资源，支持逐字节下载。

## 启动与交付

从总仓库执行：

```sh
pnpm workbench prepare oasis-editor
pnpm workbench check oasis-editor
pnpm workbench test oasis-editor
pnpm workbench dev oasis-editor
pnpm workbench package oasis-editor
```

独立 `.fbworkbench` 默认不带预览业务数据；可在 Floatboat 的工作台导入入口选择。**客户端实际导入尚未验证**。本项目不使用模型服务或 WASM，不改变模板的 CSP、SDK 或工具链。

## 保真与容量

编辑正文、常用段落格式、表格及嵌入 PNG/JPEG 等位图。宏、嵌入对象和图表文件拒绝导入；解析后图片或表格数量不足也拒绝，避免静默遗漏。文本框、扩展控件等复杂内容可能没有完整画布表现，原件及全部 OOXML 部件保留，并显示校样说明。不能承诺 Microsoft Word 的逐像素排版、宏执行、云协作或完整修订审阅。

本地 Canvas 度量、FontFace 与 PDF 共用静态 **Workbench Sans SC** 字体，PDF 嵌入字形。DOCX 使用单一合法字体名称，清理 CSS 字体列表并提供东亚字体映射；保留原件字体信息，外部 Office 仍依赖本机可用字体。界面提供常规/粗体字体下载。本地字库为常规/粗体，斜体标记保留于DOCX，但本地PDF不保证原字体的倾斜效果。安装相同字体也可能有分页差异，交付前应对照原件校样。

DOCX 原件最大 1.2 MB、展开最多 8 MB / 200 部件 / 单部件 4 MB。原生模型及图像保留原样；完整 sourcePackage 使用无损 gzip 封装，解压限制 8 MB、200 部件、元数据深度 24，并验证长度和 CRC。正式数据 850 KB；恢复数据 2 MB；完整 HTTP 请求 1.95 MB。恢复文件外层允许 12 MiB（包括历史/待确认记录和原件），实际 snapshot 不超过 1.94 MB。实测 1,929,993 字节 snapshot、4,365,320 字节外层恢复成功。超限状态保留可下载草稿，不冒充正式保存。

浏览器本机恢复仅覆盖同一来源。冲突时先下载恢复稿，再明确打开服务器版本。撤销栈与光标属于当前编辑会话；保存确认不会重建编辑器或移走光标。

[验收记录](ACCEPTANCE.md) · [结构化证据](acceptance-evidence.json) · [设计](app/DESIGN.md) · [原生来源与修改](app/notices/native-source.json)

原创适配 MIT；原生 Oasis 保留 MIT；中文字体及随上游分发的字体保留各自 OFL。详见 [第三方说明](app/THIRD-PARTY-NOTICES.md)。
