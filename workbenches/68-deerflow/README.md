# 研究交付 · DeerFlow

从研究简报向DeerFlow提交后台任务，跟踪运行并把结果整理成可审阅、可交付的研究文件。阅读原始任务与工具结果，逐条核验来源，在独立报告纸上编辑交付稿；自动保存原生快照、人工改稿、未完成输入和JSON草稿。

![研究交付工作台](../../docs/screenshots/deerflow.png)

## 已实现

- 明确提交研究任务，默认官方`context.model_name=gemini-3.8-flash`；持久命令先于远端调用，固定幂等键，未知回执只读恢复，后台运行状态与结果读取。

- 官方REST ThreadStateResponse及DeerFlowClient检查点历史导入；原生字段完整保留，消息、todos、artifacts与来源证据可查阅。
- 报告采用最新完整答复、Markdown编辑/预览、来源逐项复核、交付门禁及Markdown下载。编辑已交付报告自动回到复核状态。
- 明确配置Gateway后只读同步已有会话，持久同步记录，主动载入快照保留人工报告。无上游服务时使用文件导入路径。
- IndexedDB工作稿与SQLite规范项目、冲突保护、幂等保存、完整项目和恢复稿导入新副本。未完成URL与未应用JSON不会丢失。

这是研究交付与原生会话审阅工作台。实际官方序列化器与LangChain消息构造已验证；默认示例、HTTP契约样例均不是实际模型研究结果。研究提交接口已通过官方请求模型和HTTP契约样例验证，尚未连接真实部署执行推理；不下载上游产物原件。完整DeerFlow部署与Floatboat客户端导入待验证。

开发与打包：`pnpm workbench:check`、`pnpm test`、`pnpm package`。上游配置与限制见[SETUP](app/SETUP.md)，验收证据见[ACCEPTANCE](ACCEPTANCE.md)，官方格式验证见[verification](verification/README.md)。
