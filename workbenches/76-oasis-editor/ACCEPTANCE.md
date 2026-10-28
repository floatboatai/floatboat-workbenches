# Oasis Editor 0.8.0 验收

2026-10-28。本地功能、实际文档往返与独立源码包验证通过；**Host 导入为 unverified**。本工作台不调用模型，不使用 WASM。

## 原生链路

- 固定 `oasis-editor@0.0.195`，npm 发布 gitHead `ad0bd38f7ec7258ee2fb7a9f23fa7815a3d04195`；查询时 main 为 `d69f25e4f751ce6904a45ff56253e6d1bbc83c49`，两者在来源记录中明确区分。原包字节 hash 与适配后 hash 均保留。
- 原生 Canvas 分页编辑、静态 DOCX worker、实际 DOCX/PDF 输出在固定模板 CSP 下运行。浏览器记录无 WASM 请求、无 pageerror；未修改 SDK、tooling 或 CSP。
- 预载两份静态 CJK 字体后才初始化；Canvas 度量、FontFace、PDF 使用同一字节来源。原版中文 PDF 缺字问题已修复。DOCX 字体名规范为单一类型名，保留已有 eastAsia 或设置 Workbench Sans SC；两次回导后不再叠加 CSS fallback 字符串。
- 自带三页中文、表格和图片文稿：DOCX → 导入 → 未离焦输入“中文回流验收” → 自动保存 → 刷新 → DOCX/PDF 实际导出通过。原件下载与输入文件逐字节一致。
- 独立 python-docx 样本：3 页中文、3 张表、1 张嵌入图像、自定义 XML 部件。编辑后两次 DOCX 往返仍保留图片 hash、表格、关系和 `customXml/retained-proof.xml`；原生 PDF 三页均可读。
- 主线独立复核：原生 PDF 逐页视觉通过；二次 DOCX 由 LibreOffice 独立转换为 3 页 PDF 后逐页视觉通过，中文、表格和图像无裁切重叠。LibreOffice 使用隔离 FONTCONFIG_FILE 加载系统字体与随包字体，没有修改系统字体。Office 与原生排版存在已披露差异。

## 保存与恢复

- 原生正文、标题、笔记未离焦即进入保存，刷新恢复。回执不重新挂载编辑器，输入焦点保持。
- 保存回执延迟时继续输入，后续内容未被旧回执覆盖；服务器已提交但回执丢失时重试使用同一变更标识。
- 两窗口修改同稿：第二窗口显示冲突，其正文/笔记保留，真实下载的冲突恢复稿包含本机输入。
- 离线新建文稿，继续原生文字与格式输入，恢复网络后保存并刷新保持内容。
- 实际下载的恢复文件回导为独立新稿，空标题和未完成字段仍保留；原件字节随恢复文件携带并校验。
- 延迟 DOCX 原件写入期间继续修改标题：旧导入结果被拒绝，不覆盖当前输入。
- 多文稿切换、旧原生实例隔离通过；转场期间暂时只读并锁定字段，后台自动保存不锁定输入。
- 真实恢复入口接受 **1,929,993 字节 snapshot / 4,365,320 字节外层文件**。没有使用异步 `waitForFunction` 谓词冒充 HTTP 等待；服务端状态均由 Node 显式 await 轮询。

## 完整资源与容量

原件独立保存在声明的 `originals` 数据资源并以 SHA-256 校验。完整 sourcePackage 无损 gzip 保存，不删 OOXML；独立样本的 sourcePackage 展开 918,215 字节，压缩后整个正式工作数据 434,686 字节。8 MB 解压限制、200 部件、24 层元数据深度、3 万元数据节点、展开长度及 CRC 校验均有实现和单测。

正式数据 850 KB、恢复结构 2 MB、HTTP 请求 1.95 MB、恢复 snapshot 1.94 MB、恢复文件外层 12 MiB。DOCX 原件 1.2 MB，ZIP 展开 8 MB / 200 部件 / 单部件 4 MB。宏、嵌入对象、图表或导入后图片/表格数量不足会拒绝采用；错误不清空当前稿。

## 界面与工程

- Chrome 桌面 1440×1000 与 375×812 检查；页导航、常用排版、笔记、原件及恢复操作可用。
- 移动端有可见文稿柜和新建入口；实际完成新建 → 原生中文输入 → 保存 → 切回原稿。35% 纸张宽 285.6 px，页面 scrollWidth = 375，无页面横向溢出。
- 原生键盘文字输入、工具栏与 Tab 焦点检查；reduced-motion 使用静态界面。完整屏幕阅读器文档语义尚未专项验证。
- 应用 Vercel React 最佳实践与 Web Design Guidelines：输入受控、明确标签、focus-visible、可见保存/失败状态、移动端操作保留、无装饰动画；没有并行 remount 引发光标丢失。
- `pnpm workbench:check`、`pnpm test`、TypeScript 检查通过，**9/9 业务测试**。两条大模块提示（自动保存蓝图与页面组合）保留为维护提醒，不是编译错误。
- 主线从最终导出源码包在 **Linux node:22-bookworm** 独立运行，**9/9 通过**。

## 最终独立包

`oasis-editor-0.8.0-final.fbworkbench`，20,231,599 字节，默认排除业务数据。

SHA-256：`39af33f96027fcdb1e8823927e5ac94df226d1624b53ba199c35ecf8b0d6271f`

CRC、formatVersion 2、packageId、64 个 transfer 条目的字节数与 SHA-256、实际源码与声明资源逐字节比对全部通过。主线复核确认与集成代码的 42 个 source/config 条目和 20 个资产条目一致；原件资源状态为 excluded，不含 SQLite、缓存或凭据。

## 边界

不承诺 Word 逐像素排版、完整复杂对象、云协作或完整修订审阅。DOCX 外部消费者需可用字体；本地字库为常规/粗体，斜体标记在 DOCX 中保留，但 PDF 不保证原字体倾斜效果。超限时需要保留恢复稿并精简内容。完整屏幕阅读器语义、实际 Floatboat 导入后的客户端环境仍未验证。
