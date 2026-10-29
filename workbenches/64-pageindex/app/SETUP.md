# 安装与服务配置

本指南随工作台源码包附带。仓库级命令在[完整仓库](https://github.com/floatboatai/floatboat-workbenches)中执行，外部服务源码与锁文件位于对应项目目录；普通工作台包不包含服务运行环境。

# 页间 · PageIndex

长报告阅读台：PDF自身书签（或版面标题）生成章节目录，PDF.js在浏览器中渲染原页并提取原文，选中原文即可摘录成带页码的审阅意见；连接Floatboat后可按原页提问，引用逐字核对并标在原页上。PageIndex服务是可选的章节树增强，不是打开文档的前提。

## 使用

从总仓库运行 `pnpm workbench prepare pageindex`，再运行 `pnpm workbench dev pageindex`。不需要任何其他进程：首次打开会自动载入随包示例《Riverside Community Library 2025 Annual Service Report》（11页，带PDF书签）。

- **文档菜单**（顶部“文档 ▾”）：打开PDF、两份示例、最近阅读、导出审阅Markdown / 阅读档案（含原PDF、摘录、回答、章节树）/ 章节索引JSON / 原PDF，导入阅读档案或恢复稿（总是新档案）、导出恢复草稿、重试保存、档案JSON草稿。Escape关闭并把焦点还给按钮。
- **目录 / 检索**（左栏）：章节来源依次是PDF书签 → 版面标题识别 → 按页分段；全文检索列出页码和上下文，点击跳到原页并标出命中。
- **原页**（中间）：翻页、页码跳转、缩放（适合宽度/75–200%）、方向键翻页；在文字层选中文字后点“摘录所选”，或用“摘录本页”。摘录（黄）、已核对引用（青）、当前定位（橙）按字符范围标在原页上。
- **审阅**（右栏）：摘录原文与意见；原页问答需要Floatboat Host（默认请求 `gemini-3.8-flash`），未连接时显示原因并可重新检查。

### 可选：PageIndex章节树

左栏底部“PageIndex 章节树”卡片显示连接状态、确切启动命令并可重新检查。在完整仓库根目录：

```sh
cd workbenches/64-pageindex/service
uv venv --python 3.12 .venv
uv pip sync --python .venv/bin/python requirements.lock
.venv/bin/python server.py --port 8784
```

连接后可“生成 Flash 章节树”（`page_index_flash`，无需模型）。“生成模型章节树”调用 `page_index`（page_index_classic，`if_add_node_summary`、`if_add_doc_description`），需在启动服务前设置 `PAGEINDEX_MODEL`（LiteLLM模型名）与对应服务商密钥，例如 `PAGEINDEX_MODEL=gpt-4.1-mini OPENAI_API_KEY=… .venv/bin/python server.py --port 8784`。生成的树单独保存，可在“章节来源”中切换；问答按所选树选章节，模型树的节点摘要也会提供给章节选择。其他地址用 `PAGEINDEX_SERVICE_URL`（本机HTTP或远程HTTPS）。

## 边界

- PDF最多64MiB、1000页、原文600万字符、3000个章节节点；每份阅读档案最多200条摘录、50条问答。超限给出明确提示。
- 扫描件（无文字层）可以阅读、按页摘录，不能检索或提问；不含OCR。
- 版面标题识别是启发式：依据字号层级、编号和重复页眉过滤；排版不规则的PDF可能只得到按页分段。
- 一次问答读取所选章节中最相关的至多16页 / 6万字符；引用不在原页时记录失败，不编造回答。未确认提交保留操作编号，不自动重放。
- PageIndex章节树生成任务状态保存在服务进程内存中；工作台重启后正在生成的任务需重新点击（结果一旦生成即持久保存）。Flash树的质量取决于上游版面统计，可能出现重复或交叠的节点。
- IndexedDB恢复限定同一浏览器来源。

## 验证和交付

本目录运行 `pnpm workbench:check`、`pnpm test`、`pnpm package`；Python服务测试为 `cd service && .venv/bin/python -m unittest test_service.py`。实际证据见 [ACCEPTANCE.md](https://github.com/floatboatai/floatboat-workbenches/blob/main/workbenches/64-pageindex/ACCEPTANCE.md)。

导入：Floatboat → 我的 → 工作台 → 导入工作台，选择`.fbworkbench`。阅读、检索、摘录与导出在导入包中无需额外安装；PageIndex服务需从完整仓库单独启动。客户端导入本次未实测。

上游：[Mozilla PDF.js](https://github.com/mozilla/pdf.js)（pdfjs-dist 6.4.299，Apache-2.0）、[VectifyAI/PageIndex](https://github.com/VectifyAI/PageIndex)（MIT，仅可选服务）、[pypdfium2](https://github.com/pypdfium2-team/pypdfium2)。第三方清单见 `app/notices/THIRD-PARTY.md`。示例报告与手册为本项目自制普通资料。
