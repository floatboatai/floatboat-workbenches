# LangGraph 交付复核实现

## 架构

- `src/contracts/review.ts`：跨端结构、严格运行校验与宽松工作草稿恢复。日期真实有效；运行最多 40 条检查事项，超过限制的编辑仍按草稿完整保存。
- `src/server/checkpointer.ts`：`BaseCheckpointSaver` 的 Node 内置 SQLite 实现。checkpoint v4 使用上游 typed serializer 保存 BLOB、metadata、parent config 和 pending writes；特殊通道按 `WRITES_IDX_MAP` 更新，按上游 task-path 排序规则重放。固定单图流程，无任意子图/代码编辑入口。
- `src/server/runs.ts`：真实 `StateGraph` 的 prepare → human_review → deliver。`interrupt` 暂停，`Command({resume})` 恢复；退回则不产生交付物。SQLite 运行记录与检查点分开保存。
- `src/server/routes.ts`：项目、运行、复核、取消/恢复与模型连接状态；前端只访问同源路由。模型分支在服务端调用 Host `generateText`，显式选择 `gemini-3.8-flash`；协议、路由和凭据仍由 Host 管理。
- `src/server/model-output.ts`：只接受完整 JSON 或单层完整 JSON 代码块，要求正常 STOP、恰好五个交付字段，再执行日期、长度与检查项校验；拒绝解释文字、截断和未知字段。Host 错误只显示稳定错误代码，不暴露供应商原始信息。
- `src/ui/useReviewDesk.ts`：持久化提交命令、运行轮询、项目/交付导入导出和复核草稿。输入快照与人工修订分离；模型/流程结果不会自动覆盖当前编辑。
- `src/ui/App.tsx`、`RecordFields.tsx`、`ReviewPanel.tsx`：页面组织、字段和复核/交付呈现。`presentation.ts` 统一运行状态与本地化时间。
- `autosave-*`、`store.ts` 等沿用仓库共享版本。SQLite 完整草稿加 IndexedDB 恢复；未重写公共保存机制。

## 持久化与重试

追加 `0004_langgraph.sql`，不更改已有迁移。运行提交前保存客户端 operation ID 和输入；服务先写运行行，再执行图。相同 operation ID+输入返回同一运行，不重跑；同编号不同输入拒绝。复核使用独立操作 ID、请求快照与乐观版本。旧窗口不覆盖已提交决定。

`running` 进程启动后改为 `interrupted`，不自动重发。人工复核暂停可直接从 SQLite 恢复；已确认的 prepare 状态可继续。模型步骤没有持久结果时拒绝自动恢复，以免未知模型调用重复执行。取消中断本地调用，且数据库状态防止迟到结果成为成功；取消不保证远端模型已经停止计费。

模型调用返回后、检查点写入前仍可能存在失败窗口，因此不承诺外部模型 exactly-once。显式新建运行才启动新模型请求；requestId 用于追踪，不当作 Host 模型幂等保证。

## 数据与接口

项目数据：整理方式、原文、填写字段、选中运行 ID。工作草稿另保存未应用 JSON、某运行的复核字段/意见及未确认提交。项目导入创建新项目、清除远端运行引用和提交命令；不复活旧执行。项目导出携带输入及 JSON 草稿，交付导出单独携带已确认结果和来源快照。

运行账本返回最近 50 次，每次只取最近 16 个检查点供查看；数据库保留本流程的全部检查点。图固定三节点，单次容量有界。当前没有删除历史运行或任意图调试器。

HTTP：`GET /api/projects/:id/runs`、`GET /api/runs/:id`、`POST /api/runs`、`POST /api/runs/:id/review|recover|cancel`。编号/输入/决定在服务端验证。凭证由 Host 管理，不进入项目、浏览器或日志。

## 依赖与验证

运行时锁定 `@langchain/langgraph@1.5.3`、`@langchain/langgraph-checkpoint@1.2.1`；无 better-sqlite3、Python、Docker 或 GPU 依赖。上游 MIT 原文通过只读 `upstream-notices` 资源随源包携带。所有 Node 和 LangGraph 模块留在 server。浏览器固定 CSP 不变。

从本项目目录执行 `pnpm workbench:check`、`pnpm test`、`pnpm dev`、`pnpm package`。测试使用临时 SQLite 和真实 LangGraph 核心；fake provider 仅测试失败/取消合约，不计真实 Host。具体证据与未覆盖项见项目 `ACCEPTANCE.md`。
