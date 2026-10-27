# Milkdown 写作笔记工程记录

## 模块

- `contracts/notebook.ts`：笔记本/笔记/草稿/导出格式、有界 AST 安全校验、大纲与示例内容。unified 11.0.5、remark-parse 11.0.0、remark-gfm 4.0.1 与 Milkdown 解析语义对齐。
- `ui/Editor.tsx`：Crepe/kit 7.23.0 原生实例，ProseMirror 事务过滤和同步 Markdown 序列化、禁用图片上传/公式/AI/顶部栏，原生任务标签补充可访问名称和键盘行为。无任意 HTML 渲染/代码执行。
- `ui/stable-table.ts`：保留 Crepe 原生表格视图与控件，单元格指针事件交由 ProseMirror 即时定位，避免上游 7.23.0 延迟选区事务与紧接的输入冲突。
- `ui/App.tsx`：文档库、标签、旁注、源码应用、专注与文件导入导出。项目切换只在 `replace/open` 成功后清理相关交互；导入创建新笔记本。
- `ui/autosave-*`、`contracts/autosave.ts`、`server/autosave.ts`：仓库共享完整工作副本协议；SQLite 保存与 IndexedDB 离线缓存，幂等 mutationId、乐观版本与冲突恢复。
- `server/store.ts`、`server/routes.ts`：本地笔记本 CRUD；无 AI 或 Host 请求。保留初始 0001–0003 迁移和 appId/registryName。

原生实例按 `documentKey + note.id + sourceEpoch` 挂载，保存回执不改变 key。Milkdown 的 markdownUpdated 默认延迟 200ms；改为自定义 ProseMirror view.update 同步序列化，防止输入后立刻切换/导出丢失尾字。初始化不回写序列化结果，导入原文先精确保留；后续原生编辑使用引擎规范化输出。

## 容量与恢复

模型 700 KB、草稿 350 KB、项目存储 900 KB、自动保存请求 1.95 MB；JSON 文件上限 1.1 MB。完整导出使用紧凑 JSON，独立文件读取路径绕过 100,000 字符粘贴框上限。源码草稿是非执行纯文本，在验证前不进入编辑器。未完成笔记标题允许恢复，保存为草稿并反馈待完善状态。导出完整笔记本需有效模型，错误情况下可导出完整恢复副本。

## 验证

- `pnpm workbench:check`：manifest、依赖锁、TypeScript、构建通过。共享 autosave-client 文件产生 large-module 建议，非错误。
- `pnpm test`：8 个领域与临时 SQLite 测试通过。
- Chrome（实际系统 Chrome，Playwright）：12 条主流程通过，原生编辑后立即切换、保存回执延迟期间继续输入、Markdown 下载与完整 JSON 下载独立核验、标签/搜索、无效源码与导入稿重载恢复、标题/任务/表格/CodeMirror 源码往返与直接编辑、导入创建新项目、846,750 字节完整 JSON 导出与再次文件导入、服务器提交后丢失响应重试、全新离线稿新标签页恢复、冲突重载与打开服务器版本。最终 0 pageerror、0 外部请求、0 意外 HTTP 错误。
- 补充恢复验收：503 拒绝保存后重试、空标题草稿重载、全新离线稿切换离开后从本机列表找回、同源新标签页无法绕过冲突，全部通过且 0 pageerror。
- 视觉/交互：1440px 桌面、375px、暗色、reduced-motion 均无横向溢出和 pageerror；375px 可打开目录、切换笔记并应用源码；任务复选框可用空格切换；输入焦点可见；专注模式有效。最终普通演示数据截图已人工查看，1440×1211，SHA-256 `3d6aff54296b47eb828056f44101bfabc3727bea0544591c24eb0125fceb76dc`。
- 浏览器脚本与原始证据（忽略）：`.cache/workflow.cjs`、`workflow-results.json`、`appearance.cjs`、`appearance-results.json`、`recovery-extra.cjs`、`recovery-extra-results.json`、实际下载文件及四种外观截图。
- 预览进程停止并重启后，SQLite 自动保存记录（完整快照、项目标识、修订和冲突回执）与重启前精确相等；证据 `.cache/restart-results.json`。
- Floatboat 桌面导入未验证；未使用 Host 能力，不声称 Host 调用成功。
