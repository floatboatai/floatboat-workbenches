# 工程说明

上游：DeerFlow 源快照 `d4ed40075f9101db6424b2331ea410934af146ac`（harness 2.1.0、app 2.2.0-dev）。0.9.0 另核对了同一提交的 `routers/thread_runs.py`（后台 run、`/runs/{id}/stream` 只读加入、`/join`、取消）、`services.py`（`format_sse`、`sse_consumer`：event/data/id 帧、心跳注释、`end`、`gap` 与 `Last-Event-ID`）、`run_models.py` 与 `runtime/stream_modes.py`（`values`、`updates` 为受支持模式）、`routers/models.py`（`GET /api/models`）与 README 启动方式。

## 模块

- `contracts/research.ts`：v2 研究模型（问题、范围、计划步骤、带 `cite` 编号的来源、报告、交付状态、原生会话），旧版 v1 项目在读取时升级；引用解析与交付检查。
- `contracts/plan.ts`：模板计划、步骤问题检查、模型计划的 JSON Schema 与校验、DeerFlow 研究简报。
- `contracts/report.ts`：本地底稿、引用链接化、Markdown/HTML 导出、模型起草材料与提示词。
- `contracts/retrieval.ts`：检索请求/结果契约与合并规则（重跑保留编号、备注、核验与被引来源）。
- `contracts/native.ts`：原生会话解析、链接提取、最新答复、压缩。
- `server/retrieval/`：`net.ts` 公网读取（SSRF 防护、代理、上限、夹具来源）；`channels.ts` 网页直读/Jina/Exa/GitHub；`index.ts` 路由。
- `server/assist.ts`：Host 状态、`generateObject` 计划建议、`generateText` 报告草稿；Host 可注入以做合同测试。
- `server/deerflow.ts`：地址配置（环境变量优先，`deerflow_settings` 表次之）、`/api/models` 连通检查、只读状态读取。
- `server/research-gateway.ts`：JSON 请求与 SSE 解码、加入运行事件流。
- `server/research-runs.ts`：研究运行账本（命令先写库、未知回执只读核对），跟随事件流写入 `deerflow_run_events` 与运行中快照，断线指数退避重连，多次失败暂停。
- `server/run-events.ts`：页面事件流 `GET /api/research/:id/events`（按序号回放、Last-Event-ID、50 秒轮换连接）与 `/log`。
- `ui/useDesk.ts` 业务状态；`PlanStage`/`ExecuteStage`/`DeerFlowPanel`/`ReportStage`/`SourcesPanel`/`FileMenu` 组件；HTML 导出按需加载 `react-dom/server`。

迁移 0007 追加事件表、设置表与运行列。依赖新增 `@mozilla/readability` 0.6.0、`linkedom` 0.18.13、`remark-gfm` 4.0.1。共享自动保存文件未改动。

## 外部效果

只有用户点击执行时访问公网检索；只有用户提交时向 DeerFlow 发出写请求（每次研究两次 POST）；Host 模型只在点击起草时调用。页面加载只请求本机 API。
