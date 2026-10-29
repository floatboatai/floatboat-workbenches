# 工程说明

## 模块

| 文件 | 职责 |
| --- | --- |
| `contracts/model.ts` | 模型 `{source, theme, look}`、正式校验 `validate`（含外部资源检测）、草稿恢复 `restoreDraftData`、种子与 AI 指令 |
| `contracts/mermaid-source.ts` | 纯文本工具：外部资源检测/渲染前中和、CSS 净化、Markdown 代码块提取、frontmatter 标题、安全文件名、解析错误行映射（移植 Mermaid 12.2.0 预处理规则） |
| `contracts/templates.ts` | 17 个模板 |
| `server/routes.ts`、`store.ts` | SQLite 项目与 revision 乐观锁、`/api/generate`（Host LLM） |
| `server/app-route.ts` | `/api/app` 平台连接状态（AI 状态卡“重新检测”） |
| `ui/engine.ts` | Mermaid 懒加载、串行渲染队列（每次 `initialize` 主题/风格）、SVG DOM 净化、PNG 栅格化 |
| `ui/SourceEditor.tsx`、`mermaid-language.ts` | CodeMirror 6 编辑器、流式高亮、补全、lint 诊断 |
| `ui/Preview.tsx` | 缩放/平移舞台 |
| `ui/useRender.ts`、`RenderStatus.tsx` | 防抖渲染、问题列表、状态栏与错误条 |
| `ui/Dialogs.tsx`、`ExportControl.tsx`、`AppearanceControls.tsx`、`AiPanel.tsx` | 文件菜单、模板库、多块选择、导出、外观、AI |
| `ui/files.ts`、`recovery.ts` | 文件导入与恢复稿读取 |
| `ui/workspace.tsx` | 产品自有工作副本 hook（包装 `useWorkbenchState`）与 AI 候选稿 |

## 数据与迁移

无新迁移：theme/look 存在既有 `projects.payload` JSON 中，旧文件读取时补默认值。appId、`storageKey: "mermaid-studio"`、0001–0003 迁移不变。导出设置、AI 提示词与候选稿存于工作副本 `extra`。

## 安全

- 渲染：`securityLevel: 'strict'`、`htmlLabels: false`；渲染前 `neutralizeExternal` 去除外部 `img:` 和样式外链（Mermaid 在渲染时会临时插入 SVG 并预加载图片，所以只净化输出不够）；输出再经 `sanitizeSvg` 去除 script/iframe/表单等元素、`on*` 属性、非片段/非 data 位图引用及 CSS 外链。
- 服务端 `validate` 拒绝外部资源为正式模型（草稿仍保存）。服务端不运行 Mermaid 解析（需 DOM）；语法错误的源码可以正式保存，渲染结果单独显示。

## 依赖

CodeMirror 6 系列以精确版本加入项目根和 `app/` 的 package/lock（见 NOTICE.md），`pnpm install --frozen-lockfile` 可复现。源码构建使用官方固定模板，SDK 与本地数据不提交。

## 0.2.0 自动保存与恢复

使用统一 autosave-contracts/server/client/cache/requests 模块，0003_autosave 迁移；700ms 防抖、串行提交、documentId/mutationId 去重和 revision 冲突保护。只有合法业务模型写入 projects；未完成输入保留在工作草稿。后台同步不锁定编辑器；编辑器以 documentKey 识别文档切换（切换时重建 CodeMirror 状态以隔离撤销历史）。
