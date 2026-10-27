# 工程说明

contracts/mindmap.ts负责结构与大小校验；server/routes.ts和store.ts提供SQLite CRUD与版本保护、Host generateText生成JSON。ui/Studio.tsx负责编辑与文件操作，Mindmap.tsx按需加载实际markmap引擎并做HTML允许列表清理。

固定markmap-lib/view 0.18.12，no-plugins入口显式补markmap-common 0.18.9。禁止远程插件资源，DOMPurify仅保留内联文字标签。SVG包含foreignObject，编辑器兼容性可能不同；Markdown为原始保存格式。

数据库保持官方模板工作空间边界，导出默认不包含用户数据。验证命令为pnpm test与pnpm run package，实际浏览器验收记录在项目README。

## 0.2.0 工作草稿

使用公共 autosave contracts/client/cache/requests/server，追加独立迁移，不改原迁移。`documentId` 与 `mutationId` 去重；草稿 revision 与项目 revision 分别验证。UI 用 `documentKey`/`loadEpoch` 表示文档切换，后台保存不换 key。额外输入放 `draft`；宽松但限定类型的恢复器允许业务校验尚未通过的编辑值。
