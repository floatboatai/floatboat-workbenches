# 纸张工坊工程（0.9.0）

@pdfme/{ui,common,schemas,generator,converter,pdf-lib} 六包精确 5.4.6，React 19.2.3 + Node 22，遵循模板严格 TypeScript 与固定 Vite 编译；root/app 两份清单与锁一致，本轮未新增依赖。

## 浏览器引擎

上游 common/schemas 的 ESM 含裸 `buffer` 导入，固定模板会拒绝该 Node 名称，因此 `scripts/build-browser-vendor.mjs` 用 esbuild（platform=browser）把 `scripts/pdfme-entry.mjs` 打成 IIFE：Designer/Form/Viewer、generate、全部字段插件、`pdf2img`/`pdf2size`、pdf-lib `PDFDocument`。产物 `src/vendor/pdfme-browser.js` 以 `?url` 同源按需加载，不修改模板、Vite 或 CSP。pdfjs 3.11 的 worker 以主线程方式随包内置。`browser-engine.ts` 把插件按中文标签注册（Designer 元素栏与类型选择显示键名，渲染按 schema type 查找）。

- 字体：`fonts.ts` 读取同源 OTF，作为唯一且 fallback 的字体；`contracts/domain.ts` 在校验时把任意深度的 `fontName`（表格样式、日期、下拉等）统一改为 NotoSansSC。
- 缩略图：`PageRail` 防抖后用生成器渲染当前数据再 `pdf2img`（scale 0.32，最多 40 页），输出 data URL（CSP 不允许 blob: 图片）。
- Viewer：pdfme 5.4.6 在 Viewer 构造时打印弃用提示；`surface.tsx` 只过滤这一条已知提示。

## 数据与资源

- `PdfProject = { template, values, dataset? }`。`dataset` 保存原始 CSV/JSON（`source`）、格式、字段→列映射、ZIP 文件名列与所选行；行在页面中解析（`contracts/dataset.ts`）。
- 二进制槽位（PDF 底图、图片内容与填写值、数据源）为 ≤ 96 KB 的 data URL 或 `fbasset:<sha256>`。`0004_assets.sql` 新增 `assets` 与 `asset_parts`；`server/assets.ts` 接收 1 MiB base64 分块（低于 SDK 2 MB 请求上限）、校验 SHA-256、大小上限与文件头后入库，`GET /api/assets/:id` 以原 MIME 返回。`registerAutosaveRoutes` 的 `verify` 在事务前核对引用都在，缺失时只存草稿。
- `ui/assets.ts`：`hydrate` 把引用换成 data URL 交给 pdfme；`dehydrate` 把回传的已知 data URL 映射回引用，新出现的大文件（Designer 中上传的照片）先上传再进入模型。Designer 的 `onChangeTemplate` 经串行泵处理，文档切换后丢弃迟到结果。
- 导入：`importDocument` 识别本工作台导出（`kind: floatboat-pdfme`）、0.3 项目 JSON 与 pdfme 模板（含旧版键值 schemas），先上传大文件再完整校验，经 `replace` 创建新项目。导出把引用内联。
- 迁移 0001–0003 保持不变。

## 生成

`ui/pdf.ts`：单份 `generate`；合并 PDF 每 25 行一批生成后用 pdf-lib `copyPages` 合并，期间让出主线程、可取消；ZIP 逐行生成后由 `contracts/zip.ts`（STORE、UTF-8 文件名、CRC32）打包。PDF 元数据标题为模板名或文件名。

## 自动保存

共享 `autosave-client.ts`/`autosave-cache.ts`/`requests.ts` 与服务端 `autosave.ts` 未修改。设计器属性框的未完成输入仍以 `extra.designerInputs` 保存（`designer-draft.ts`），在“待应用的属性输入”中修正或丢弃。

## 测试

`tests/support/pdf.ts` 在 Node 中用同一插件集与字体生成 PDF，并用 pdf.js（legacy build，仅读取文字）检查页数与文字；见 `../ACCEPTANCE.md`。`scripts/make-samples.mjs` 可复现示例标志 PNG 与证书底图 PDF。
