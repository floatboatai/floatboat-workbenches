# 乐谱审校工程（0.9.0）

固定 Node 22、React 19.2.3、严格 TypeScript、官方 Vite profile。root/app 精确依赖与锁一致：opensheetmusicdisplay 2.2.1、fast-xml-parser 5.11.2、jszip 3.10.1、lucide-react 0.562.0。覆盖规则移除 OSMD 的 gl 原生可选依赖。0.9.0 没有新增依赖：PDF 由自带的最小写入器生成，回放用浏览器 Web Audio。

## 模块

- `contracts/musicxml.ts`：BOM/声明编码解码；安全检查（接受标准 DOCTYPE，拒绝内部子集/实体/样式表）；fast-xml-parser 解析出声部、谱表数、小节号、拍号延续、著录（work-title / movement-title / creator / credit-words / rights）与警告。8 MB 文件约 0.7 s。
- `contracts/archive.ts`：MXL 中央目录检查、按真实输出字节计数的流式解压（JSZip `internalStream`，上游类型缺此方法，窄类型补充并运行时检查），`readSource()` 统一入口。
- `contracts/domain.ts`：模型 `{source: SourceRef, index, view, annotations, focus}` 与逐字段校验；`restoreScoreDraft` 只放宽空白正文。枚举值用 `Object.hasOwn` 防原型键。
- `contracts/samples.ts` + `score-builder.ts`：记谱串生成标准 MusicXML 并逐小节检查时值；`sha256.ts` 为种子同步生成与服务端一致的原件标识。
- `contracts/report.ts`（批注 JSON v2）、`contracts/pdf.ts`（每页一张 DCTDecode JPEG 的 PDF 1.4，UTF-16BE 标题）。
- `server/sources.ts`：`score_sources` / `score_source_parts`（迁移 0004）。768 KB 原始字节一块（base64 后约 1 MB，低于运行时 2 MB 请求上限）；finish 时校验块序、长度与 SHA-256，解析失败 422；MXL 解压结果与索引一并入库；`/api/sources/:id/musicxml` 与 `/original` 以 immutable 缓存返回。内置示例启动时写入。`verify(project)` 在自动保存事务之前核对原件存在且索引一致。
- `server/legacy.ts`：0.3.x 项目与自动保存草稿（原件 base64 内嵌）启动时迁入原件库并改写结构，项目 revision +1，草稿与回执同步；只处理一次。
- `score/engine.ts`：OSMD 选项映射（版式、小节号、标题、声部名、光标、关闭自动合并多小节休止以保持小节一一对应）、移调、几何查询（GraphicalMeasure 外框、拍位横坐标、点击命中最近谱表与音符）、光标定位、在每页 SVG 内绘制批注层、页面快照与拼接、屏幕外渲染。
- `score/ScoreView.tsx`：持有 OSMD 实例；原件变化时新建，显示设置变化时同实例重排，批注/位置变化只重绘批注层。`score/playback.ts`：基于光标迭代器（clone 预读下一时值）的 Web Audio 调度。`score/exporter.ts`：SVG→canvas（data: URL，符合 CSP）→ PNG/JPEG，批注清单页用 canvas 排版中文后进 PDF。
- UI：`App.tsx` 状态与流程，`FileMenu`（乐谱库）、`ScoreToolbar`、`Ledger`、`Menu`（Escape/外部点击关闭并还焦点）、`sources.ts`（分块上传、MusicXML 缓存两份）。

## 边界

- 批注坐标存在 SVG 用户坐标里（OSMD 单位 × 10），因此缩放、导出与打印保持对齐；在“无限滚动/单行横卷”版式下导出 PDF 时另做一次屏幕外 A4 排版。
- 回放为简单合成音色，不区分乐器、不演奏装饰音/力度变化；反复记号按 OSMD 迭代器展开。
- OSMD 排版在主线程执行。本机 Chrome 从选择文件到出图：12 声部 240 小节的 MXL 约 2 s（31 页），8 声部 1200 小节的 5.4 MB MusicXML 约 5 s（76 页）。
- 未引用的原件保留在原件库，暂无回收。

## 验证

`pnpm workbench:check` → `pnpm test`（17 项）→ `pnpm dev` 真实浏览器（1440 / 375、暗色）→ `pnpm package`。没有 Host 能力调用；客户端导入安装不由本地预览代替。scripts/collect-licenses.mjs 可重新生成生产依赖许可证汇编。
