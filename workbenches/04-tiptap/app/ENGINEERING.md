# 写作台工程

## 依赖

全部 Tiptap 包精确 3.32.0（MIT）：`@tiptap/{react,core,pm,starter-kit}`，0.9.0 新增 `@tiptap/extension-list`（TaskList/TaskItem）、`extension-table`（TableKit）、`extension-image`、`extension-highlight`、`extension-text-align`、`extensions`（Placeholder、CharacterCount）、`suggestion`（`/` 菜单）、`markdown`（MarkdownManager，传递依赖 marked 17.0.6）。React 19.2.3、Node 22。root 与 `app/` 两份清单与锁一致，`--frozen-lockfile` 可用。

## 结构

- `contracts/schema.ts`：唯一的扩展集合 `documentExtensions({editor})`，编辑器、HTML 导出、Markdown 转换与服务端 AI 解析共用，保证语法一致。图片扩展只解析 `data:image/(png|jpeg|webp|gif)`，粘贴的外部图片不会进入文稿；链接 `isAllowedUri` 与校验器一致。
- `contracts/domain.ts`：`validateWriting` 是所有外部 JSON 的边界（节点父子语法、属性白名单、链接/图片安全、容量）；`safeHref`、`normalizeLinkInput`、`textStats`、`outline`。示例文稿在 `contracts/sample.ts`。
- `contracts/markdown.ts`：`MarkdownManager` 无需 DOM，可在浏览器和 Node 使用。导入先把解析结果清理成受支持结构（外部图片→链接文字、不安全链接去除、未知块退化为文字、标题级别收敛），再校验；导出前把强调范围两端紧贴文字的中文标点移出，避免 CommonMark 定界规则导致「**不足：**与」无法读回。
- `contracts/files.ts`：完整备份格式、JSON 导入识别（备份 / 0.3.0 `{content}` / 裸 doc / 恢复草稿）、HTML 外壳（转义标题、内联样式）、安全文件名。
- `server/index.ts`：注册 `/api/app`（Host 状态）、文稿与生成接口；自动保存使用写作台适配器（`store.create(title,data,id)`），新建上限与正式保存一致为 1.6 MB 校验 + 1.7 MB 数据库兜底，而不是默认适配器的 900 KB。共享 `server/autosave.ts`、`ui/autosave-client.ts`、`autosave-cache.ts`、`requests.ts` 未改。
- `server/routes.ts`：`/api/generate` 让模型输出 Markdown，服务端 `fromMarkdown` → 校验后返回；Host 未连接/不可用分别给出可操作的提示。
- `ui/RichEditor.tsx`：编辑器实例、粘贴/拖入图片、拖入 `.md/.json` 导入、目录跳转与插入接口（`apiRef`）。`EditorChrome` 只在实例就绪后用 `useEditorState` 订阅工具条状态；`setEditable(x,false)` 不发出更新。`scrollMargin/scrollThreshold` 为吸顶页头与工具条让位。
- `ui/Toolbar.tsx`、`SelectionBubble.tsx`（`@tiptap/react/menus` BubbleMenu）、`slash.ts` + `SlashMenu.tsx`（Suggestion 桥接到 React）、`LinkPopover.tsx`、`images.ts`（解码、缩放、WebP/JPEG 编码、大小目标）、`Outline.tsx`、`AssistantPanel.tsx`、`DocumentMenus.tsx`（Esc/外部点击关闭并归还焦点）、`render.ts`（按需加载的 generateHTML/Markdown，供导出与候选稿预览）。
- `WritingApp.tsx`：编排；`useDeferredValue` 计算字数和目录，编辑器回调经 ref 保持稳定，RichEditor 不随每次输入重渲染。

## 验证顺序

`node scripts/workbench.mjs check tiptap` → `test tiptap`（23 项）→ 真实浏览器（Playwright，空数据目录）→ `package tiptap`。见 [ACCEPTANCE.md](ACCEPTANCE.md)。

## 迁移

无新迁移：文稿仍存于 `projects.payload`，0.3.0 的文稿是新校验器的子集，直接可读。
