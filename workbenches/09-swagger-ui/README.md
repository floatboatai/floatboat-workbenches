# Swagger 接口参考台

版本 **0.3.0**。编辑后自动保存，不必反复点击保存按钮。

端点目录、原生Swagger接口文档和Try it out console；JSON规格按需并排编辑。支持OpenAPI 3.0/3.1、本地同源GET试调和JSON导出。

未应用或错误JSON保留原文，只有点击应用才更新接口文档。导入创建新项目，保留原项目。

自动保存区分待同步、保存中、已保存、工作草稿、离线和版本冲突。网络失败会保留本机工作副本并重试；冲突不会覆盖服务器版本，可导出恢复草稿后打开服务器版本。“立即保存”用于手动触发同步。

从总仓库运行 `pnpm workbench prepare swagger-ui`、`pnpm workbench dev swagger-ui`。本目录执行 `pnpm workbench:check`、`pnpm test` 与 `pnpm run package`。

业务测试 4 项；自动保存另经真实Chrome验收：无需按钮创建、延迟回包不覆盖新输入、草稿刷新恢复、503/重试、响应丢失幂等、冲突保留、375px与暗色。AI草稿恢复测试使用明确注入的候选，未据此宣称新一轮真实模型调用成功。

源包：`artifacts/swagger-ui-studio-0.3.0.fbworkbench`。通过Floatboat「我的→工作台→导入工作台」安装。源包不含项目数据；客户端实际导入尚未验收。

上游与许可见 [NOTICE.md](NOTICE.md)。

## 0.3.0 保存基础修复

快速编辑后撤回到已确认内容时，保存状态和本机工作副本一起恢复；服务端草稿回执与缓存重试按统一协议处理。整合验收见 [0.3.0 发布记录](../../docs/release-0.3.0.md)。
