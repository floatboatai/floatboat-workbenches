# 写作台

版本 **0.9.1**。基于 Tiptap 3.32.0 的方案、报告与 SOP 写作编辑器：一张连续的稿纸，左侧章节目录，按需打开的写作助手。不需要 Floatboat Host 即可完成写作、导入和导出；只有写作助手调用 Host 模型。

![写作台](../../docs/screenshots/tiptap.png)

## 0.9.0 能做什么

- **完整的格式**：标题 1–3、粗体/斜体/下划线/删除线/行内代码/高亮、链接、有序/无序/任务列表、引用、带语言的代码块、分隔线、左/中/右/两端对齐、200 步撤销重做。按钮提示显示快捷键（⌘/Ctrl+B、⌘K、⌘⇧8…），⌘/Ctrl+S 立即保存。
- **贴着正文的工具**：吸顶格式条；选中文字时浮出格式条；键入 `/` 打开插入菜单（标题、列表、任务、引用、代码、表格、图片、分隔线，支持 `bg`、`todo` 等关键词过滤）；链接浮层只接受 http(s)/mailto/# 并自动补全 https://。
- **表格**：插入/删除行列、切换标题行、合并拆分单元格、拖动列宽。
- **图片**：选择、粘贴或拖入；原图最大 25 MB，自动缩放到长边 1600 px 并压缩为 WebP，作为文稿自带数据保存（不引用外部地址，去除 EXIF）；可写替代文字、拖动调整宽度。
- **结构与统计**：左侧目录随标题生成、标出当前章节、点击跳转；底部字数（中文按字）、字符数与阅读时长。
- **导入导出**：Markdown 导出（GFM 表格、任务清单、高亮）与导入为新文稿（frontmatter/一级标题作为文稿名，外部图片改为链接、危险链接移除）；HTML 导出带文稿标题与内联样式，无脚本、无外部资源；完整 JSON 备份可原样导入；也支持把 `.md/.json` 拖到页面。
- **文稿菜单**：新建空白、新建示例方案、导入为新文稿、最近文稿、删除；「导出」菜单另有立即保存与恢复草稿下载。
- **写作助手**：Host 已连接时按要求生成候选稿（可参考当前正文，图片不发送），预览后插入到光标处或替换全文；未连接时显示状态卡与「重新检测」。
- **示例**：首开即是一份约 800 字的《社区共享图书角改造方案》，含表格、任务清单、链接、引用与高亮。

## 运行

在总仓库执行 `pnpm workbench prepare tiptap`，本目录执行 `pnpm workbench:check`、`pnpm test`、`pnpm dev`、`pnpm run package`。无 Host 的本地验收可用 `FLOATBOAT_HOST_MODE=offline node tooling/cli.mjs preview --no-watch`。在 Floatboat → My → Workbenches → Import workbench 导入生成包，默认不包含预览数据。

## 验收

功能验收与结构审查分开记录，见 [app/ACCEPTANCE.md](app/ACCEPTANCE.md)。业务测试 23 项。真实 Chrome（Playwright，空数据目录，Host 离线）走通：首开不建档、选区浮条、链接拒绝 `javascript:`、`/` 插入表格与任务、表格行列操作、10 MB 图片压缩嵌入与替代文字/缩放、对齐快捷键、目录跳转、刷新恢复全部结构；延迟保存期间继续输入、回包丢失重试幂等、空标题草稿恢复；Markdown/HTML/JSON 导出内容校验，Markdown/JSON/恢复草稿导入为新文稿；菜单 Esc 与焦点、删除、375 px。Host 已连接时完成一次真实生成 → 刷新保留 → 插入。源包：`artifacts/tiptap-studio-0.9.1.fbworkbench`；客户端实际导入尚未验收。

边界：文字 300,000 字符、整份文稿（含图片）1.6 MB、导入文件 8 MB。对齐在 Markdown 中丢失；不支持 SVG、HTML/Word 导入、协作与分页。

[上游](https://github.com/ueberdosis/tiptap)；来源与许可见 [NOTICE.md](NOTICE.md)，设计与实现见 app/DESIGN.md、app/ENGINEERING.md。

## 历史

- 0.3.0：快速编辑后撤回到已确认内容时，保存状态和本机工作副本一起恢复。整合验收见 [0.3.0 发布记录](../../docs/release-0.3.0.md)。
