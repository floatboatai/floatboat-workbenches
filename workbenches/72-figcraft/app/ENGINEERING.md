# FigCraft 校样工程

## 模块
- `contracts/figdoc.ts`：fflate 读写 `.figcraft`（大小/展开/路径/结构校验、循环检测），`outline` 画板目录，`parseAction`/`applyEdits` 纯函数修改（rename/text/fill/status/move），`writeArchive` 只替换 `document.json`、固定时间戳以保证同输入同输出。浏览器与服务端共用。
- `contracts/paint.ts`：填充/渐变/颜色、矢量网络（regions 环→可填充闭合路径，全部线段→描边）、椭圆弧、文字样式、圆角、分边描边、阴影的换算。
- `contracts/handoff.ts`：交付说明 Markdown。
- `server/design-routes.ts`：`POST /api/design/inspect`、`POST /api/design/edit`（1–200 个操作）、`GET /api/engine-status`、`POST /api/engine`（引擎不可达→503 + `ENGINE_UNAVAILABLE`）；自动保存 `verify` 拒绝损坏的 zip（保存为草稿）。
- `server/engine.ts`：可选引擎连接，区分“未运行/超时/认证失败/不是适配器”。
- `ui/ProofCanvas.tsx`：DOM/SVG 近似渲染（自动布局 flex、fill/hug/fixed、strokes_included、绝对子项、clip、混合模式、图层模糊）；`ui/svg-export.ts` 从实际 DOM 量取位置导出 SVG，并经 data: URL 栅格化 PNG（页面 CSP 不允许 blob: 图片）。
- `ui/App.tsx`/`ReviewPanel.tsx`/`ProofFiles.tsx`/`EngineCard.tsx`：舞台、复核栏、文件对话框、引擎卡。
- `service/`：独立 Node 22 适配器，execFile 调用 CLI 0.11.2；修改前与只读渲染前执行 `text.refit`，只读渲染返回原文件。

## 数据
正式数据 `{file: base64 zip, notes: {frameId: text}}`，存 `projects`；草稿字段 `texts`/`frameNames`/`fills`（按节点 id 的字符串）、`frameId`、`layerId`、`tab`、`json`、`jsonOpen`。无新迁移；appId、storageKey `figcraft-review-v1` 不变。项目与草稿上限 1.95 MB（SDK 请求 2 MB）。

## 依赖
fflate 0.8.3（MIT，精确版本，根与 app 均记录），许可见 `notices/THIRD-PARTY-fflate.txt`。CLI 不随源码包分发。

## 验证
`node scripts/workbench.mjs check|test|package figcraft`；14 项应用测试；`service/` 5 项真实 CLI 测试（需 `FIGCRAFT_CLI`）。浏览器验收见 ACCEPTANCE.md。
