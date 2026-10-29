# 工程说明（0.9.0）

Node 22 / React 19，模板固定构建配置与 CSP。新增运行时依赖 pptxgenjs 精确 4.0.1（与 05-pptxgenjs 相同版本；root 与 app 两份清单和锁同步）。浏览器加载 npm 官方 `dist/pptxgen.bundle.js` 的原字节副本（`src/vendor/`，`?url` 同源脚本；官方 ESM 含 Node `fs` 动态导入，模板构建不接受），类型来自 `import type`；Node 测试直接导入 `pptxgenjs`。App identity 与迁移 0001–0004 保留，0005 新增图片媒体表。manifest 声明 `llm`。

## 模块

- `contracts/model.ts`：Deck v2（brief、outline、slides、theme、Presenton settings、result）、上限、`restoreDeck`（草稿：结构与大小，允许未完成值）、`validateDeck`（正式：900 KB、每页有标题、图表值为数字）、0.4 `schemaVersion 1` 确定性迁移。
- `contracts/brief.ts`：资料解析（标题/中文序号标题/无标题短行、段落、列表与续行、表格、引语与出处）、数字/时间/关键数字抽取、分句与要点压缩（整句优先、去引导语、不截断数字）。
- `contracts/generate.ts`：`outlineFromBrief`（版式选择规则、表格转图表与结论、续页、目录、结尾、目标页数精简、生成说明）、`slideFromItem`/`slidesFromOutline`、`switchLayout`。纯函数，同一输入同一输出。
- `contracts/brief-import.ts`：.docx（自带 ZIP 读取，只解压 document/styles）、HTML、CSV/TSV、GB18030 文本到 Markdown。
- `contracts/model-outline.ts` + `server/model.ts`：Host 起草提示词与宽松解析；`createModelChannel(host)` 封装 `capabilities.list` 与 `llm.generateText`，可注入 mock。
- `contracts/deck.ts`：示例文稿（`sample-brief.ts` 原创资料经本地生成器产出）、Presenton 请求映射、Presenton/便携/恢复导入、Markdown 讲义。
- `shared/geometry.ts`：每种版式的英寸坐标图元与统一字号估算；`shared/marks.ts`：图表与插画标记；`shared/themes.ts`：主题。三个渲染器共用：`ui/SlideView.tsx`（HTML/SVG 舞台与缩略图）、`ui/render-canvas.ts`（Canvas：PDF 页面与 PPTX 插画位图）、`shared/pptx-render.ts`（PptxGenJS 原生对象）。
- `shared/pdf.ts`：最小 PDF 1.4 写出（每页 JPEG/DCTDecode、UTF-16 标题、精确 xref）。`shared/zip.ts`：ZIP 读写与 PptxGenJS 段落属性修正（与 05 同源，读取增加按名过滤）。
- `server/media.ts` + `contracts/media.ts` + `ui/media-client.ts`：图片媒体库（与 05 相同实现：内容哈希去重、1.4 MB、PNG/JPEG/GIF 识别）。
- `server/presenton.ts`、`server/jobs.ts`、`contracts/operation.ts`、`ui/submission-guard.ts`：Presenton 连接器与持久任务账本，契约未变；`/api/presenton` 不再报错而返回配置状态，`/api/presenton/check` 返回可达性。
- UI：`App.tsx`（外壳、步骤、恢复条）、`FileMenu.tsx`（文件生命周期与导出）、`BriefStep.tsx`、`OutlineStep.tsx`、`DeckStep.tsx`、`Inspector.tsx`、`PresentonPanel.tsx`、`ConfirmBar.tsx`、`channels.ts`、`export.ts`。

## 持久化

共享 `autosave-client.ts`、`autosave-cache.ts`、`requests.ts`、`server/autosave.ts` 未修改。`registerAutosaveRoutes(app, validateDeck, undefined, { verify })`：verify 检查引用的图片均在媒体库，否则保存为草稿。storageKey 仍为 `presenton-studio-v1`，旧本机恢复项经 `restoreDeck` 迁移。图片不进项目 JSON（便携导出时以 base64 附带，导入时重新入库并重映射 ID）。extra 字段按类型解码（`restoreExtra`）。

## 外部效果

- 本地生成、编辑、导出不访问网络。
- Floatboat 模型：仅在用户确认后调用 `app.host.llm.generateText`，发送资料前 6 万字；结果只作候选。
- Presenton：仅在配置 `PRESENTON_URL` 且用户提交时调用，契约见 `PRESENTON.md`。

## 验证

仓库根：`pnpm workbench check presenton`、`pnpm workbench test presenton`、`pnpm workbench package presenton`；工作台目录：`pnpm dev`。浏览器验收脚本与截图在仓库外（见 ACCEPTANCE.md）。已知提示：共享 `autosave-client.ts` 的 `WORKBENCH_LARGE_MODULE`。
