# LogicFlow 流程图纸

原生 LogicFlow 审批 / SOP 编辑、节点连线与条件、结构检查、路径审阅、PNG 图纸和原生 JSON 导出。图纸主屏与审阅栏可收起；完整工作稿自动保存，未应用 JSON 也可刷新恢复。

- 引擎：`@logicflow/core@2.2.5`、`@logicflow/extension@2.3.1`。
- 本地启动：根仓库 `pnpm workbench prepare logicflow`，本目录 `pnpm dev -- --no-watch`。
- 验证：`pnpm workbench:check`、`pnpm test`、真实 Chrome 工作流。
- 打包：`pnpm run package`。Floatboat → My → Workbenches → Import workbench；客户端导入尚未验证。
- 原生 JSON 为图数据；完整工程还含审阅与编辑稿。恢复稿支持实际 snapshot 格式并导入新副本。默认包不含业务数据。

业务角色/结构规则用于人工审阅，不自动执行审批。悬空对象保留并报告；自定义注册节点不转换成内置类型。边界见 [REQUIREMENTS](app/REQUIREMENTS.md)，验收见 [ACCEPTANCE](ACCEPTANCE.md)。

[LogicFlow upstream](https://github.com/didi/LogicFlow) · Apache-2.0。原创集成采用范围限定 MIT，第三方保留原许可。展示图：![流程图纸](../../docs/screenshots/logicflow.png)
