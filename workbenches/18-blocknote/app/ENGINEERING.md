# 工程说明

- `contracts/notebook.ts` 是服务端与 UI 共用的有界知识页契约，白名单验证全部块、属性、内联格式、链接、表格和嵌套。仅类型引用 BlockNote；不会在 Node 引入 DOM 引擎。
- `ui/App.tsx` 用 OSS `BlockNoteView` 和 `useCreateBlockNote`，明确限制 schema。任务块在原生 render 返回前增加可访问名称，保持上游交互和导出。编辑器仅在 documentKey 变化时重建，ACK 不替换 document。标题/摘要/分类和 onChange 块 JSON 写入自动保存工作副本。
- `ui/imports.ts` 从 JSON / 工作副本恢复有界结构。HTML 先在 inert template 中做白名单清理，再交给原生解析器，避免先加载媒体再清理。粘贴采用同样的 HTML 边界；Markdown 解析结果必须通过契约。导入始终 await replace，新建独立项目。
- `ui/autosave-client.ts`、cache、requests 和 `server/autosave.ts` 使用仓库标准完整工作副本协议：700ms debounce，120ms local cache，稳定 mutationId、draft/project revision、乐观锁。自动保存不把 busy 传到编辑器。原始导入输入随 extra 保留，UI 明确标注未应用。
- `server/routes.ts` 只注册本地页库读/删除与自动保存 API，移除骨架 LLM 路由和 AppInfo。`store.ts` 负责参数化 SQL 与版本检查。既有 0001–0003 迁移保留。
- 模型限制 700 KB，低于项目 900 KB 与自动保存请求 1,950,000 bytes 上限。草稿源文限制 180,000 字符，让普通多字节源文与模型能同置于请求内。
- MPL-2.0 完整许可与第三方声明通过 licenses 项目资源随源码包打包。
- 仅有本地 SQLite 业务操作，不调用 Host SDK 模型/agent。浏览器连接仍使用模板 `connectWorkbenchPage`；权限声明为空。
- 根项目及 app 精确锁定 BlockNote core/react/mantine 0.56.0、Mantine core/hooks 9.0.2；React 19.2.3。使用当前模板编译器与固定 CSP，无构建配置或运行时补丁。

## 验证命令与范围
`pnpm workbench:check`、`pnpm test`、`pnpm dev -- --no-watch`、仓库根 `pnpm workbench package blocknote`。9 个契约/SQLite/自动保存测试；实际 Chrome 证据位于忽略的 `.cache/acceptance.mjs`、`acceptance-results.json`、导出文件及视口截图。README 截图复制到仓库 docs/screenshots。

Floatboat 导入后的桌面验收未执行。预览报告 HOST_CONNECTED 只是连接状态，不是业务 Host 调用；本应用无此类调用。
