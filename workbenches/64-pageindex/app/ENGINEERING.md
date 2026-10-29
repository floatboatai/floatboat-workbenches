# PageIndex 工程说明（0.9.0）

## 运行边界

- 浏览器：pdfjs-dist 6.4.299 打开PDF、渲染画布与文字层、逐页提取原文（`ui/extract.ts`），读取PDF书签（`getOutline` + `getDestination/getPageIndex`），没有书签时用版面字号与编号识别标题（`contracts/outline.ts` 的 `detectHeadings`），仍无结果按10页分段。Worker经Vite `?url` 同源打包；CMap与标准字体由 `GET /api/pdfjs/:group/:file` 从声明资源 `pdfjs-assets`（`app/pdfjs/`）提供；`useWasm:false` 适配模板CSP，无CDN请求。
- Node服务：原PDF（1MiB分块、SHA-256）与提取结果（JSON分块并带SHA-256）上传后校验入库：`reader_documents` 保存原文与本文档章节树，`documents` 数据资源保存原PDF。同一哈希再次打开直接复用（`GET /api/documents/:id/stored`，避免404探测）。原件缺失时只补原PDF。自动保存在提交前校验原件（按大小+mtime缓存哈希结果）。
- 可选PageIndex服务（`service/server.py`，Python）：`flash` 模式 `page_index_flash(summary=False, optimize=False)`；`classic` 模式 `page_index(..., if_add_node_summary="yes", if_add_doc_description="yes")`，需要服务进程环境 `PAGEINDEX_MODEL` 和对应服务商密钥。Node端 `server/outlines.ts` 检查健康状态、在后台任务中生成章节树（内存任务状态，轮询），验证哈希/页数/节点范围后存入新表 `reader_outlines`（迁移0005），文档接口附带 `outlines`。服务地址 `PAGEINDEX_SERVICE_URL` 仅允许本机HTTP或远程HTTPS。
- Host问答（`server/questions.ts`）：显式 `gemini-3.8-flash`；第一步按所选章节树（含PageIndex摘要/描述）选章节，忽略未知ID、最多4章；第二步在所选章节内按问题词项排序取最多16页/6万字符（`rankEvidence`），没有可用章节时按词项从全文取页；引用逐字核对。模型输出可带不完整的```json围栏，但JSON本身必须完整。

## 数据

ReaderData：`document, page, question, notes[{id,page,quote,text}], archivedAnswers, outline("document"|"pageindex-flash"|"pageindex-classic"), zoom(0=适合宽度|50–300)`。旧档案缺少 `outline/zoom` 时取默认值。未应用JSON、检索词、未确认提问在 `draft`。阅读档案格式 `floatboat-pageindex` v1 增加 `outlines`；导入时重新用PDF.js读取原PDF并恢复章节树。迁移0001–0004保留，新增0005。

## 模块

`contracts/reader.ts`（上限、校验、章节树选择）、`contracts/outline.ts`（标题识别、建树、引用字符定位、检索、证据排序）、`contracts/archive.ts`（档案/恢复稿解析、审阅Markdown、段落所属章节）、`server/documents.ts`、`server/outlines.ts`、`server/questions.ts`、`ui/extract.ts`、`ui/pdf.ts`、`ui/files.ts`、`ui/useReader.ts`、`ui/useService.ts`、`ui/PdfPage.tsx`、`ui/ContentsPane.tsx`、`ui/ReviewPane.tsx`、`ui/DocumentMenu.tsx`、`ui/StageParts.tsx`、`ui/App.tsx`。

## 许可

pdfjs-dist Apache-2.0（`pdfjs/LICENSE` 与字体许可随包）；PageIndex MIT（`notices/PageIndex-LICENSE.txt`，仅可选服务）；清单见 `notices/THIRD-PARTY.md`。
