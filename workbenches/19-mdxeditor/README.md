# MDXEditor 文档审阅台

版本 0.3.0。面向产品说明、教程与 Markdown 文档的写作和审阅桌面。

![文档审阅台](../../docs/screenshots/mdxeditor.png)

使用真实的 **@mdxeditor/editor 4.3.3**：正文编辑、原生 Markdown 源文与原生并列差异视图。提供标题、粗体/斜体、列表/任务项、引用、链接、表格、代码块与撤销/重做。比较基线独立于当前稿保存，更新基线需要确认；整篇文档的审阅意见支持编辑、完成和重新打开。

编辑自动保存完整工作副本，包括源文、基线、意见及尚未提交的意见/导入输入。无效源文保存为草稿；离线或冲突有明确状态、重试、恢复导出和服务器版本入口。编辑器仅在文档切换时重新挂载，保存确认不重置光标或新输入。

支持 Markdown / 审阅项目 JSON 文件和粘贴导入，始终创建新文档。Markdown 导出当前原文；审阅项目 JSON 导出正文、比较基线、全部意见与未完成输入。650 KB 文档加完整草稿的导出可经独立文件路径重新导入，文件上限 1.1 MB，粘贴输入限 100,000 字符。

边界：专注文档审阅，不执行任意 MDX/JSX 组件或代码块。HTML/JSX、Markdown 图片保留为可恢复源文，不加载远程媒体；代码块中的示例保持普通文本。普通大括号与 import/export 文字不会执行。链接限 http/https/mailto/页内锚点，编辑表面不导航。不含图片附件托管、实时多人协作、逐行批注锚点或 AI。IndexedDB 恢复限同源同浏览器；源代码包默认不含预览业务数据。

在仓库根目录执行：

```sh
pnpm workbench prepare mdxeditor
pnpm workbench check mdxeditor
pnpm workbench test mdxeditor
pnpm workbench preview mdxeditor
pnpm workbench package mdxeditor
```

也可以在本目录运行 `pnpm workbench:check`、`pnpm test`、`pnpm dev -- --no-watch`。生成的 `.fbworkbench` 通过 **Floatboat → 我的 → 工作台 → 导入工作台** 安装。

已验证：类型/依赖/构建检查通过；9 项契约与临时 SQLite 测试通过（包含 >900 KB 完整项目的导出/导入边界）。真实 Chrome 验证正文输入、工具栏加粗、原生表格/代码编辑、源文/差异切换、基线更新、意见状态、Markdown 和完整项目实际下载及内容检查、导入新文档、刷新/预览重启恢复、未完成输入恢复、延迟 ACK 中继续输入且编辑器实例不变、服务端提交后丢失响应的幂等重试、503 恢复、冲突保护、新标签页不能绕过冲突、新建离线草稿切换找回。375px 与 1440px、深色/reduced-motion、键盘焦点和页面无水平溢出已检查；没有页面异常或意外外部资源请求。故障注入的失败请求仅用于恢复验收。证据脚本和辅助截图保存在忽略的 `.cache/`。

本工作台不调用 Host 业务能力；Floatboat 桌面导入仍未验证。构建仅保留共享自动保存模块体积提示，没有检查失败。

上游与许可：[MDXEditor 文档](https://mdxeditor.dev/editor/docs/getting-started)、[差异/源文](https://mdxeditor.dev/editor/docs/diff-source)、[源码](https://github.com/mdx-editor/editor)。`@mdxeditor/editor` 4.3.3 与 `mdast-util-from-markdown` 2.1.0 均为 MIT，原始声明保留在 `app/licenses/`。工作台设计与数据边界见 `app/DESIGN.md`、`app/REQUIREMENTS.md`、`app/ENGINEERING.md`。
