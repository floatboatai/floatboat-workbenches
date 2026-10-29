# Docling 0.9.0 验收记录

日期：**2026-10-29（America/Los_Angeles）**。接手基线为 WIP `f752d73` 与 7 个未提交文件，均保留并承接。本文替代 2026-10-27 的 0.4.0 验收作为本次结论；没有将历史浏览器运行计入当前通过数。

## 之前与现在

| 0.4.0 | 0.9.0 |
| --- | --- |
| 仅 HTML / 400 KB 官方服务上传，本地只能导入 JSON 校订 | 浏览器离线 PDF、Word、HTML、Markdown 转换，原文件 64 MiB、结构 48 MiB，内容资源与校订分开 |
| 无 PDF 原页、无 Word 上传 | PDF 原页 canvas + 坐标框联动；Word 样式/编号/合并表格解析，非 PDF 原文片段对照 |
| 单个轻量 HTML 示例 | 5 页水质报告（4 表与图）、巡检 Word、交接 Markdown；另外实际转换 11 页图书馆 PDF |
| Serve 固定 HTML 选项 | 官方格式映射、OCR/语言/页码/表格等选项，状态/启动/重新检查紧贴操作 |
| Markdown / JSON / 单表 CSV | 增加独立 HTML、全部表格 CSV、含原文件的 ZIP 往返 |
| 旧验收和静态文档 | 当前独立浏览器/Node 22 证据；修复逐键输入焦点丢失、嵌套列表行号与切源页码；测试资源适应包内规范化路径 |

## 环境与隔离

Node **22.23.4**，pnpm **10.22.0**，独立 Playwright 无头 Google Chrome for Testing（chromium-1200），1440×900 / 375×812，reduced-motion。各流程各自创建本轮空 SQLite/资源目录与浏览器 context，服务使用操作系统分配的空闲 loopback 端口；结束关闭自己启动的应用和 fixture。

预览为已构建的真实 `app/dist/server/index.mjs`，启动配置 **hostConnection:null**、`FLOATBOAT_HOST_MODE=offline`。Serve 指向本轮临时 loopback 端口；fixture 启动前验证未运行状态，启动后仅返回本机已记录 Docling 输出，不运行模型。浏览器请求只放行本机，所有流程均记录外网请求数为 0。没有连接真实 Host、LLM、NewAPI 或外网服务做验收。

本轮独立证据目录：`workbenches/57-docling/.local/handoff-20261029/`，包含 `run.mjs`、`flow-*.mjs`、`results-*.json`、`browser-*.log`、`runtime-*.json`、数据库、截图与实际导出文件。运行器可在本目录用同一 Node 22 执行 `node .local/handoff-20261029/run.mjs <流程名>`；脚本复用旧 archive 内已安装的 Chrome/Playwright/Python 工具。此目录不进入 Git/源码包。

## 自动化与浏览器功能验收

`pnpm workbench:check` 检查 manifest、锁定依赖、类型与构建。`pnpm test` **35/35**：转换、结构与导出、真实 SQLite 持久化、资源分块与哈希、Serve 合同和应用响应。新增嵌套列表行号回归覆盖父项续行、空行、嵌套兄弟和 CRLF。HTML 测试文件随 fixtures 资源打包，测试按 manifest 找到规范化后的资源。

浏览器 **99/99 个断言**（不是 99 个独立测试用例）：

| 流程 / 结果文件 | 断言 | 本次实际覆盖 |
| --- | ---: | --- |
| local | 25 | 空数据首屏准确为 5 页/50 框；点选表格框；DOCX 36 项/33 原文片段；新输入 11 页 PDF 84 项/6 表；文本和复核刷新恢复；Markdown/HTML 转换、源行号；JSON、Markdown、HTML、单表 CSV、全部 CSV、ZIP 真实下载；ZIP 新建导入后恢复原页；损坏 PDF 保留旧文档且错误可操作；菜单 Escape/焦点返回 |
| autosave | 13 | **服务器已提交但响应暂扣**时继续输入，刷新保留后续内容；提交后丢响应重试复用原 mutation ID/document ID 且不重复建文档；503 非成功状态与手动重试；无效 JSON 草稿刷新恢复；导入创建新记录 |
| conflict | 10 | 另一修订先写入，本地保存冲突不覆盖；新标签页恢复冲突；导出本地工作副本；显式读取服务器版本；恢复导入新建且保留本地备注 |
| mobile | 19 | 375px 空数据首屏、无页面横溢、结构到原页再到单元格校订、保存与文稿一致；主触点 44px；PDF/DOCX/HTML/Markdown 全部转换；Markdown 下载包含校订值；JSON 新建导入、最近文档及刷新恢复 |
| serve | 15 | 服务未运行/启动说明/重新检查；本机 fixture 版本；DOCX multipart 文件及官方字段；异步任务成功与显式新建采用；Word 原文 33/33 对齐；引擎及 fast/OCR/语言选项刷新恢复；任务历史 |
| focus | 7 | JSON 逐键输入完整保留；后台保存不抢焦点；Tab/Shift+Tab 在转换弹窗内循环；Escape 关闭并返回触发按钮 |
| empty | 6 | 无文档校对副本的空态入口；打开示例新建；菜单重新打开原空副本；从空态转换真实 Markdown |
| screenshot | 4 | 1440 校订及自动保存后截图；375 等待 PDF canvas 完成截图；无非预期错误/外网请求 |

local 的外网零请求断言另见 `browser-local.log`（记录在结果文件写出后），未额外计入 99。其他流程均在关闭浏览器后汇总。无非预期 console error/pageerror；autosave 仅将主动注入的 503 与响应中断作为预期故障。

实际下载的 11 页 PDF 校订 JSON 再次由本机 Python `docling_core.types.doc.DoclingDocument.model_validate_json()` 验证通过：76 个文本、6 张表、11 页，原生 Markdown 导出含校订值。这里只是**原生 schema/导出兼容性检查**，不是官方模型重新转换。

## 本轮发现并处理

- 转换面板 effect 使用每次渲染变化的 close 回调：旧脚本 `fill()` 可通过，真实逐键输入仅留下 `{`。改为稳定回调后完整 JSON 和保存期间焦点均通过；文件菜单同样使用稳定回调。
- Markdown 嵌套列表源行号曾将整个列表范围套到各项，且多行父项下嵌套起点偏移。按实际 item/token 原文位置计算并补回归。
- PDF 切换源时重置当前页码；源加载完成前卸载时不再启动迟到的解析任务。
- 保留接手的 legacy PDF.js 构建、源标题、引擎/选项随新文档保留、源片段标签和窄屏样式修复。
- 打包不包含 app/tools，且会规范化资源目录；将测试 HTML 纳入 fixtures 并按 manifest 解析测试资源。

## 结构审查与截图

结构审查独立记录于 DESIGN.md，并实际对照 PageIndex 与 pdfme 截图。结果：通过本轮范围。真实截图 `docs/screenshots/docling.png` 为 1440×900 的水质报告，当前表格已复核、备注已自动保存；375×812 截图见 `.local/handoff-20261029/shot-375-final.png`。两张均检查了 PDF canvas 内容，未使用早期尚未渲染完成的截图。

## 打包与可复核交接

REQUIREMENTS/DESIGN/ENGINEERING/本记录在打包前定稿。打包输出为 `artifacts/docling-studio-0.9.0.fbworkbench`；若已有同版本文件，先归档后重打，不覆盖。包生成后核对 application 中每个源码、文档、测试、迁移与资源文件的 SHA-256，manifest 仅允许模板 schema 默认值及资源路径规范化，并检查资产锁/传输索引。最终包哈希、验包结果与解包测试日志写到本地 `package-verification.json` / `package-tests.log`，随最终交接报告给出；包哈希不写入包自身文档。

模板默认打包清单包含 REQUIREMENTS/DESIGN/ENGINEERING，**不包含 ACCEPTANCE.md、项目根 README/NOTICE 或 app/tools**。这些留在 Git；不修改共享打包器扩大清单。

## 未覆盖与剩余限制

- **真实 Host / LLM 未测**；官方 Docling Serve/OCR/版面模型未启动，浏览器 Serve 是本机 fixture，不代表 live 推理验收。Floatboat 客户端导入、升级与授权未测。
- 本地 PDF 依赖文字层和启发式几何，扫描件需 OCR；旋转/竖排、多栏、复杂无框表格准确率不保证。DOCX/HTML/Markdown 是原文片段，不是原页像素渲染。图片/公式不作完整富媒体输出。
- 不编辑表格行列拓扑或跨父级移动；JavaScript 数值解析不保证原 JSON 字节保真。
- 64/48 MiB、50,000 项等为保护上限，未进行满额文件性能验收。大量同步 XML/HTML/Markdown/ZIP 解析可能阻塞页面；本轮样本为普通多页资料。
- 源文件和结构为本机资源；恢复 JSON 的引用需同一资源库。跨安装移交请用 ZIP 校对包。旧 0.4 数据读取有单测，未导入真实客户端数据库做升级验收。
- check 的 pdf-layout、autosave-client、App 三个大模块提示非阻断。共享工具 `check` 与 `test` 都会重建生成 SDK：并行运行曾报 `unlink app/sdk/resources.mjs ENOENT`；顺序执行以避免竞争。本次不改共享工具或蓝图。

旧 archive 仅复用了工具、普通样本和已记录 Serve fixture 输出。旧记录曾把 11 页数据误标为“首屏 5 页”，本轮已以独立空数据和精确页数断言更正；不把旧 0.4.0 文档或旧浏览器截图当成本轮证据。
