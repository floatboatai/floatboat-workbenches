# Mermaid 图形工坊

版本 **0.2.0**。编辑后自动保存，不必反复点击保存按钮。

源码IDE与图形预览分屏，支持同步行号、源码/SVG导出及人工采用AI候选。图形引擎保持严格模式。

空白或错误源码、AI提示词和待采用候选均保留；源码已保存与预览是否成功分别显示。

自动保存区分待同步、保存中、已保存、工作草稿、离线和版本冲突。网络失败会保留本机工作副本并重试；冲突不会覆盖服务器版本，可导出恢复草稿后打开服务器版本。“立即保存”用于手动触发同步。

从总仓库运行 `pnpm workbench prepare mermaid`、`pnpm workbench dev mermaid`。本目录执行 `pnpm workbench:check`、`pnpm test` 与 `pnpm run package`。

业务测试 4 项；自动保存另经真实Chrome验收：无需按钮创建、延迟回包不覆盖新输入、草稿刷新恢复、503/重试、响应丢失幂等、冲突保留、375px与暗色。AI草稿恢复测试使用明确注入的候选，未据此宣称新一轮真实模型调用成功。

源包：`artifacts/mermaid-studio-0.2.0.fbworkbench`。通过Floatboat「我的→工作台→导入工作台」安装。源包不含项目数据；客户端实际导入尚未验收。

上游与许可见 [NOTICE.md](NOTICE.md)。
