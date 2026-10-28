# Engineering

`src/ui/NativeEditor.tsx` 按 `documentKey` 挂载原生 Canvas 编辑器，内容变化按序列化 wire 去重回流，保存回执不重新加载文档。`engine.ts` 在初始化前加载两份静态字体；失败时显示错误，不能悄悄回退到缺字字体。文件解析使用临时原生实例，确认成功才创建新稿。异步操作同时核对文稿 key 与输入版本。

`src/contracts/document.ts` 区分 850KB 正式数据与 2MB 可恢复数据；`source-package.ts` 无损压缩原始 OOXML 部件，并对解压尺寸、部件、元数据深度、CRC 做校验。`docx-fonts.ts` 规范 OOXML 的 rFonts，不允许将 CSS fallback 列表写作字体名，保留既有 eastAsia，缺失时映射 Workbench Sans SC。

`src/server/routes.ts` 只提供文稿、自动保存、原件资源，不提供 AI 端点。SQLite 使用固定蓝图事务、文档修订与幂等 mutationId；保存前校验原件资源 hash。`originals` 是声明的数据资源，默认导出不包含预览数据。`native`、`fonts`、`notices` 为声明的项目资产，API 仅映射固定资产清单。

原生发布版 JS/CSS/静态 DOCX worker 在 `src/vendor/oasis-editor/`，原始与修改后 SHA-256 在 `notices/native-source.json`。改动仅涉及字体字节入口、DOCX 单字体边界、移动端缩放下限。未更改模板 SDK/tooling/CSP。字体 family 与 glyph 数据来自完整静态 400/700 字体，没有跨项目运行依赖。

验证：`pnpm workbench:check`、`pnpm test`、`pnpm exec tsc -p app/tsconfig.json`、真实 Chrome 文档输入/导出/恢复/故障测试、独立 OOXML/PDF/Office 回验、`pnpm workbench:pack` 后检查 ZIP CRC、transfer/source/资源 hash。Host imported-client verification 是独立未完成项。
