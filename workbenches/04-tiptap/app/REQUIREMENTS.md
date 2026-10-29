# 写作台需求与验收

## 主流程

在稿纸上写作（标题 1–3、段落、粗体/斜体/下划线/删除线/行内代码/高亮、链接、有序/无序/任务列表、引用、带语言的代码块、表格、图片、分隔线、对齐）→ 自动保存与恢复 → 导出 Markdown / HTML / 完整 JSON；Markdown 或 JSON 导入为新文稿。写作助手（Floatboat Host）生成候选稿，预览后插入或替换。

## 功能要求

- 选中文字浮条：加粗、斜体、下划线、删除线、行内代码、高亮、链接；光标在链接内时显示地址、编辑、打开、移除。
- `/` 插入菜单：正文、标题 1–3、无序/有序列表、任务清单、引用、代码块、表格（3×3 含标题行）、图片、分隔线；方向键选择、回车插入、Esc 关闭；支持拼音首字母/英文关键词过滤。
- 链接浮层（⌘/Ctrl+K）：只接受 http、https、mailto 与 `#` 锚点；裸域名补全为 https://，邮箱补全为 mailto:；拒绝时内联提示。
- 表格：上/下插入行、左/右插入列、删除行/列、切换标题行、合并/拆分单元格、删除表格、拖动列宽。
- 图片：本机选择、粘贴或拖入；原图上限 25 MB，缩放到长边 1600 px 并重新编码为 WebP（不支持时为 JPEG），去掉 EXIF；小于约 480 KB 的 PNG/GIF 保留原文件。图片作为 data URL 由文稿自己持有。可编辑替代文字、拖动把手调整宽度、恢复版心宽度、删除。不支持 SVG。
- 对齐：段落与标题左/中/右/两端对齐。
- 快捷键在按钮提示中显示（按平台显示 ⌘ 或 Ctrl），并写入 `aria-keyshortcuts`；⌘/Ctrl+S 立即保存。
- 撤销/重做（200 步）、字数（中文按字、英文按词）、字符数、阅读时长，目录导航并标出当前章节。
- 导出：Markdown（`# 标题` + GFM 表格、任务清单、`==高亮==`、`++下划线++`、代码语言）；HTML（`<title>` 与 `<h1>` 为文稿标题，内联样式，无脚本、无外部资源）；完整 JSON 备份（`format: floatboat-writing`, `version: 1`）。文件名去除路径分隔符、控制字符和 Windows 保留名。
- 导入：`.md/.markdown/.txt/.json`，上限 8 MB；Markdown 的 frontmatter `title` 或首个一级标题成为文稿标题；外部图片不下载，改为链接文字；不安全链接移除但保留文字；原始 HTML 只作为文字保留；四级以下标题并入三级。总是新建文稿。
- 写作助手：Host 已连接时生成候选稿，可选「参考当前正文」（以 Markdown 发送，图片换成替代文字，上限 30,000 字符）；模型返回 Markdown，服务端解析、清理并校验后才返回。未连接时显示状态卡与重新检测，其他功能不受影响。

## 数据边界

- 节点：doc、paragraph、heading(1–3)、bulletList、orderedList、listItem、taskList、taskItem、blockquote、codeBlock、horizontalRule、hardBreak、table、tableRow、tableHeader、tableCell、image、text。标记：bold、italic、underline、strike、code、link、highlight。
- 属性白名单：对齐（left/center/right/justify）、标题级别、列表起始号、代码语言（字母数字与 `+#.-_`）、任务勾选、单元格合并与列宽、图片 src/alt/title/width/height。
- 图片 src 只允许 `data:image/(png|jpeg|webp|gif);base64`；链接 href 只允许 http/https/mailto/#，统一 `target=_blank rel="noopener noreferrer"`。没有脚本，没有除用户链接以外的远程资源。
- 文字总量 300,000 字符，节点 40,000，嵌套 40 层，整份文稿 JSON（含图片）1.6 MB。超限的工作副本仍保存为草稿，正式内容不被覆盖。

## 自动保存

停止输入约 700 ms 后保存，后台请求不锁编辑。正文、写作要求、「参考当前正文」开关与待采用候选稿随工作副本保存；空标题等无效输入显示「草稿已自动保存，待完善输入」，不会覆盖最后的合法内容。网络失败时保留本机副本并自动/手动重试；版本冲突提供恢复草稿下载与服务器版本入口。

## 验收

见 [ACCEPTANCE.md](ACCEPTANCE.md)。
