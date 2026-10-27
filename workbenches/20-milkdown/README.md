# Milkdown 写作笔记

使用 **Milkdown Crepe 7.23.0** 的 Markdown 笔记本。正文居中排版，目录与标签管理笔记，大纲帮助跳转章节，页边笔记记录写作线索；专注模式收起两侧。

![Milkdown 写作笔记](../../docs/screenshots/milkdown.png)

## 能力

- 原生可视编辑：标题、强调、引用、列表、任务清单、表格、CodeMirror 代码块、文字链接；代码只编辑，不执行。
- 一个笔记本容纳 1–30 篇笔记；搜索标题/正文/标签，添加或移除标签，添加/删除笔记，保存旁注与标题。
- Markdown 源码编辑、验证后应用；未应用的源码、粘贴导入稿和标签输入会自动保留。
- 自动保存到 SQLite，离线工作副本存入同源 IndexedDB。保存回执不重建编辑器。冲突保留双方版本，提供恢复副本导出与打开服务器版本。
- Markdown 文件导出；完整笔记本 JSON 导出含原文、标题、标签、旁注和未应用草稿。Markdown/JSON 导入创建新的笔记本，保留原笔记本。

## 内容边界

Markdown 每篇最多 100,000 字符，笔记本模型最多 700 KB，未应用稿总计 350 KB，完整 JSON 文件最多 1.1 MB；粘贴框最多 100,000 字符。大型完整 JSON 必须使用文件选择器导入，导出文件可在此上限内再次导入。旁注每篇最多 10,000 字符、标签最多 8 个/每个 24 字。

使用 Markdown AST 校验，拒绝图片、原生 HTML、嵌入、相对链接和可执行协议。支持 http/https/mailto/文内锚点链接，不自动访问链接目标。代码块不执行；无 AI、公式、附件或远程资源加载。粘贴富文本转为编辑器支持的文本结构；图片拒绝导入。Markdown 在原生编辑后按 Milkdown 的格式规范重新序列化（例如列表符号/空白），正文语义保留；导入或明确应用源码后未编辑时，Markdown 导出保持原始文本。恢复副本用于故障取证；可再次导入的是完整笔记本 JSON。

本地恢复仅限同一浏览器、同一 origin（含端口），不是跨设备或跨预览地址同步。超过粘贴容量而校验失败的 JSON 文件仍由原本地文件保管，不会进入草稿。单次预览重启使用新端口时，已确认的内容由 SQLite 恢复。

## 开发与安装

在仓库根目录运行 `pnpm workbench prepare milkdown`、`pnpm workbench check milkdown`、`pnpm workbench test milkdown`、`pnpm workbench dev milkdown`、`pnpm workbench package milkdown`。也可在本目录运行 `pnpm workbench:check`、`pnpm test`、`pnpm dev`、`pnpm package`。

产物在本目录 `artifacts/`。安装：**Floatboat → My → Workbenches → Import workbench**。源包不包含预览数据库或浏览器缓存。

## 验证与来源

契约与 SQLite 测试覆盖安全 Markdown、结构/容量边界、未完成输入、近上限完整 JSON 往返、幂等重试、冲突和导入独立记录。Chrome 运行记录见 `app/ENGINEERING.md`；本机脚本、下载核验与截图保存在忽略目录 `.cache/`。Floatboat 桌面导入尚未验证；本产品不使用 Host 能力。

- [Milkdown 文档](https://milkdown.dev/docs/guide/using-crepe)
- [Crepe 源码](https://github.com/Milkdown/milkdown/tree/main/packages/crepe)
- [Milkdown listener](https://github.com/Milkdown/milkdown/tree/main/packages/plugins/plugin-listener)
- [unified](https://github.com/unifiedjs/unified)、[remark-parse](https://github.com/remarkjs/remark/tree/main/packages/remark-parse)、[remark-gfm](https://github.com/remarkjs/remark-gfm)

以上依赖采用 MIT 许可；`app/src/THIRD_PARTY_NOTICES.md` 保留上游许可文本。应用依赖固定版本并同步两份锁文件。
