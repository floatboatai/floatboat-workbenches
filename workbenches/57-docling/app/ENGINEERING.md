# Docling 0.9.0 工程约定

身份保持 `workbench.eace0c23-7f0d-4c80-888b-6a1f0cccb38e` / `docling-studio@0.9.0`。Node 22.x、React 19.2.3；新增生产依赖锁定为 pdfjs-dist 6.4.299、parse5 7.3.0、marked 16.4.2、fflate 0.8.2。模板固定在 `3b55d46f7ae25e939ce3299073c37ed334d69c02`；未更改 SDK、CSP 或共享保存蓝图。manifest 无模型能力声明。

## 模块和数据

- `contracts/convert/`：PDF 文字/操作列表提取与启发式版面分析；OOXML ZIP/XML 样式、编号与表格；HTML/Markdown 结构及源行号；统一 DocBuilder 生成 DoclingDocument。Markdown 嵌套列表按 token 的实际位置计算行号，含续行和空行。
- `contracts/docling.ts`、`review.ts`、`exports.ts`：结构/引用/环/坐标校验；原件独立校订层；同级排序；JSON/Markdown/HTML/CSV 投影。JSON 使用 JavaScript Number，不保证原始字节或超安全整数保真。
- `server/blobs.ts`、`sources.ts`、`ui/library.ts`：SHA-256 内容寻址、分块上传、完成校验、示例源和 PDF.js 本地字体/CMap。原件上限 64 MiB、结构 48 MiB。大型原件不重复塞入自动保存请求。
- `ui/convert.ts`：浏览器本地解析、原件/结构入库、旧项目迁移、JSON 与 ZIP 往返。PDF loading task 在结束时销毁。校对 ZIP 携带原文件，恢复 JSON 仅携带工作副本/引用。
- `ui/PageView.tsx`、`SourceView.tsx`、`ReviewParts.tsx`：PDF canvas 与坐标框、非 PDF 原文片段、结构/校样/校订联动。可见区域按需渲染；换源重置页码，已卸载页面不启动迟到的 PDF 加载。
- `ui/App.tsx`、`DocumentMenu.tsx`、`ConvertSheet.tsx`：文档生命周期、转换/导出、服务任务。关闭回调稳定，避免每个字符或后台保存重新执行焦点 effect；模态面板包含 Tab 循环。
- `server/docling.ts`、`contracts/jobs.ts`：官方 Serve 文件异步 API 客户端，服务端固定 origin、拒绝重定向、超时和有界结果流。浏览器仅访问工作台同源 API。
- 迁移 `0005_sources.sql` 追加内容资源与任务扩展；`0001`–`0004` 原迁移保留。旧 0.4 嵌入原件项目仍可读取，打开后写入资源并保留校订。

## 保存和服务边界

`Review` 保存原文件与 DoclingDocument 的摘要引用、corrections、order 和来源；校订正式模型 800 KB、恢复稿 1.2 MB、完整 title/data/extra 1.85 MB。未应用 raw、engine、serveOptions、taskId 进入 extra。SQLite 与 IndexedDB 共同保留工作副本；服务端核对校订引用确实存在于结构原件。不合法业务输入可为 draft，不覆盖正式模型。采用转换/导入结果调用 replace 创建新文档，保持原记录。

Serve 默认 `127.0.0.1:5001`，`DOCLING_SERVE_URL=off` / `none` 关闭；其他地址与密钥从服务端环境读取。先保存输入哈希和本地操作，再提交 `/v1/convert/file/async`，持久化 task ID，调用 status/poll 和 result。请求不确定时不自动重交；刷新恢复已有操作。返回结构入库后等待用户明确采用。暂停只停止本地轮询，不能承诺上游取消。结果流 ≤64 MiB，结构仍须符合 48 MiB 校验。

本地 PDF 为文字层与绘图线条启发式，不包含 Docling 神经网络模型、OCR、Python 或远程服务。扫描件会提示 OCR；旋转/多栏及复杂表格需要人工核对或官方服务。非 PDF 原文按文本匹配 Serve 结果，不能保证每段可匹配；界面显示匹配数量。PDF.js 使用 legacy 构建、本地 worker/CMap/字体、禁用 WASM 以适配固定 CSP。

## 验证与交付

本轮 Node **22.23.4** / pnpm **10.22.0**：prepare → check → test → 独立浏览器 → 完成文档 → package → 验包。测试资源从 manifest 解析，HTML 测试素材包含在声明的 fixtures 资源内，避免源码检验通过但包内测试缺文件。35 项单测包含真实 SQLite、文件资源、转换与明确命名的 Serve 合同测试。浏览器运行在本轮独立空数据目录与临时端口，启动配置 `hostConnection:null` / `FLOATBOAT_HOST_MODE=offline`；浏览器网络只放行 loopback。Serve 仅由本机 fixture 返回已记录结构；Python docling-core 仅离线验证实际导出的 JSON。

本轮证据保存在 `.local/handoff-20261029/`：运行脚本、按流程独立数据库、日志、结果 JSON、截图和下载样本。旧 `archive/2026-10-29-workbench-depth/docling` 只作为工具/样例和历史来源，本次结果均重新采集。源码与包不包含 `.local` 数据；现有包若存在先归档，不覆盖同版本输出。验包逐项核对 `application/` 与 `app/`，manifest 资源仅允许模板规范化，验证结果写入本地证据。

`pnpm workbench:check` 保留 pdf-layout、autosave-client、App 三个非阻断大模块提示；不修改共享模块以消除提示。真实 Host/LLM、官方 Serve/OCR、Floatboat 客户端导入和最大尺寸性能不属于本轮通过项。详见 ACCEPTANCE.md。
