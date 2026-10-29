# 演示编排室工程（0.9.0）

pptxgenjs 精确 4.0.1，React 19.2.3 + Node 22，严格 TypeScript 与模板固定 Vite 编译；无新增依赖，root/app 两份清单与锁一致。

## 模块

- `contracts/domain.ts`：Deck v2 模型（主题、页面、五类元素）、严格校验 `validateDeck`、草稿恢复 `restoreDeckDraft`（结构与上限不变、允许未完成业务值）、0.3.0 旧格式确定性迁移。
- `contracts/layouts.ts`：10 个版式母版（背景角色、装饰矩形/文字、占位定义与默认元素）、主题预设、颜色角色解析、`applyLayout`、`onPlaceholder`。舞台与导出共用。
- `contracts/seed.ts` + `server/demo-media.ts`：示例文稿与本仓库绘制的门店插画（JPEG，SHA-256 由测试核对）。
- `contracts/outline.ts`：AI 大纲 JSON 的宽松解析与转换为母版文稿。
- `contracts/media.ts`、`server/media.ts`、`migrations/0004_media.sql`：媒体库（文件头识别、尺寸读取、1.4 MB 上限、内容哈希去重），`GET/POST /api/media`。
- `shared/pptx-render.ts`：`renderPresentation(PptxGenJS, deck, title, media)`：`defineLayout`、每个版式 `defineSlideMaster`（含占位符与页码）、`addText`（TextProps[] 富文本）、`addImage`（contain 精确计算 / cover 用 `sizing`）、`addTable`、`addChart`、`addShape`、`addNotes`、隐藏页。浏览器与 Node 测试使用同一函数。
- `shared/zip.ts`：极简 ZIP 读写（CompressionStream `deflate-raw` + CRC32）。PptxGenJS 4.0.1 给多片段段落写出多个 `<a:pPr>`（违反 OOXML，可能触发修复提示），`normalizePptx` 只保留段首的一个；测试也用它解包校验。
- UI：`DeckApp`（外壳、快捷键、导入导出）、`DeckMenu`、`Rail`、`Stage`（指针拖动/缩放/吸附、就地富文本编辑与格式条）、`SlideView`/`ChartView`（96 px/in 逻辑尺寸渲染再整体缩放）、`Inspector`/`ElementPanels`/`InspectorFields`、`AiPanel`、`Slideshow`、`history.ts`、`geometry.ts`、`richtext.ts`、`media-client.ts`、`export-deck.ts`。

官方 ESM 含 Node `fs` 动态导入，模板构建会拒绝；浏览器继续按需加载 npm 官方 `dist/pptxgen.bundle.js` 原字节副本（`?url` 同源脚本），类型来自 `import type`。Node 测试直接导入 `pptxgenjs` ES 包。

## 持久化与自动保存

共享 `autosave-client.ts`、`autosave-cache.ts`、`requests.ts`、`server/autosave.ts` 未修改。`registerAutosaveRoutes(app, validateDeck, undefined, { verify })`：`verify` 检查文稿引用的媒体都已入库，否则保存为草稿。项目 900 KB 上限不受图片影响（图片在媒体表）。AI 候选稿与提示词存于工作副本 `extra`。

## 验证顺序

`node scripts/workbench.mjs check pptxgenjs` → `test` → 预览中真实浏览器流程 → `package`。详见 [ACCEPTANCE.md](ACCEPTANCE.md)。维护 vendor 资源：`node scripts/copy-browser-vendor.mjs`、`node scripts/collect-licenses.mjs`。

已知结构提示：`DeckApp.tsx` 与 `domain.ts` 超过模板 450 行建议（分别为外壳/快捷键与模型校验/迁移），共享 `autosave-client.ts` 同样有该提示。
