# Engineering

## 0.9.0 结构

- `src/ui/Ribbon.tsx`：功能区外壳，包括选项卡、快速撤销/重做/查找和「开始」选项卡。`RibbonTabs.tsx` 负责插入、表格（上下文）和布局，`ReviewTools.tsx` 负责审阅工具与批注面板，`ribbon-kit.tsx` 提供 Tool、Group、Popover、色板和 `useEditorSnapshot`。快照在原生 `change`、`selectionChange` 和 `uiChange` 事件触发时，通过 rAF 合并刷新。所有按钮都调用 `client.commands.execute(name, payload)`，不另写一套编辑逻辑。
- `src/contracts/review.ts`：纯函数模块，包括纸张尺寸（按 twips 定义，A4 为 11906×16838）、页边距预设、修订列表与前后导航、批注增改，以及选区和文档位置的换算。由 `tests/review.test.ts` 覆盖。
- `src/ui/use-review.ts`：修订者姓名保存在 localStorage，修订开关保存在文稿的 `trackChanges` 字段。该字段可选且为布尔值，不需要迁移，旧数据可以直接读取。
- `src/ui/images.ts`：插入图片时，200 KB 以内、长边不超过 2400px 的 PNG/JPEG/GIF 原样保留；其他图片按 1600/1280/1024px 重新编码为 JPEG，目标 280 KB。超过 30 MB 或无法解码的文件会给出明确提示。
- `src/ui/fit-zoom.ts`：用 ResizeObserver 计算“适合宽度”。用户手动选择缩放后，不再自动覆盖。
- `src/ui/demo.ts`：首屏示例，即城南社区共享书房改造项目建议书。
- `src/ui/locale-zh-CN.ts`：原生 629 个界面键的简体中文表，由 `tests/native.test.ts` 校验键名和占位符。

## 保存与 OOXML

`source-package.ts` 用无损 gzip 封装导入文稿的完整 OOXML 部件，并做两项去重：

1. 与模型 data URL 完全相同的 `word/media/*` 部件只保存一个 `wbimg:<key>` 引用。
2. 每个导入块的 `ooxmlSource`（逐字 XML 和语义签名，用于让未修改的块逐字节导出）移入压缩归档，模型中只保留 `wbsrc:<n>`。以验收中导出的建议书为例，未做这一步时，模型的 sections 部分约 437 KB，加上一张 300 KB 照片后超过 850 KB，导出的文件无法重新打开。现在同类文稿的 sections 约为 80 KB，逐字 XML 压缩后存入归档。

恢复时会逐项还原这些引用。引用缺失时直接拒绝打开，不会静默丢图或改写结构。`validateImport` 拒绝超过预算的导入并说明原因；编辑过程中超限的文稿按蓝图保留为草稿。

## 原生内核修改

原生发布版 JS、CSS 和 DOCX worker 位于 `src/vendor/oasis-editor/`。每一处修改及修改前后的 SHA-256 都记录在 `notices/native-source.json`，摘要如下：

- 新增 zh-CN 语言注册入口和修订者姓名入口。
- 在 Canvas 上绘制修订颜色。
- 合并 run 时区分修订，连续输入沿用当前修订。
- 状态提交时保留修订开关、活动区域和脚注 id。
- `setSelection` 可以切换到脚注区域。
- 中文按字断行，并处理避头尾，同时修正中文段落首行为空的问题。
- 编辑正文时，页眉页脚不再显示灰带。
- 表格单元格内的图片导出时补上命名空间声明。
- 段落导出时，若设置了首行缩进，不再写出 `w:hanging="0"`（否则 Word 会忽略首行缩进）。

模板 SDK、tooling 和 CSP 均未改动；`autosave-client.ts`、`autosave-cache.ts`、`requests.ts` 和服务器端蓝图也未改动。

## 0.8.x 延续

`NativeEditor.tsx` 按 `documentKey` 挂载原生编辑器。保存回执不会重新加载文稿；面板开关只改变 UI 状态。`engine.ts` 在初始化前加载两份静态字体。`docx-fonts.ts` 负责规范 rFonts。服务器端只提供文稿、自动保存和原件资源三类接口，SQLite 写入通过 mutationId 保证幂等。
