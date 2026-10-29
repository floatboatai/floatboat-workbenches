# 安装与网络配置

本指南随工作台源码包附带。0.9.0 起不需要另起服务：GitHub、网页和 V2EX 的采集都在工作台自己的 Node 服务内完成。

## 网络

- 采集只在点击「采集」时访问对应网站：GitHub REST、V2EX API、`r.jina.ai`（网页阅读）、`mcp.exa.ai`（网页搜索），或你输入的网页本身（直接读取 / Jina 失败后的回退）。
- 需要代理时，在启动 Floatboat 或 `pnpm workbench dev agent-reach` 之前设置 `HTTPS_PROXY`、`HTTP_PROXY`（仅支持 `http://` 代理），可用 `NO_PROXY` 排除域名。
- 本机、内网、链路本地地址和 `.local` / `.internal` 等名称一律拒绝读取，重定向到这些地址同样被拒绝。
- GitHub 匿名接口每小时约 60 次；达到限额时显示 `RATE_LIMITED`，请稍后再试。

## 模型概括（可选）

需要运行中的 Floatboat 桌面端。工作台声明了 `llm` 能力；在「研究小结」页点「检查连接」后才会联系 Floatboat。未连接时只有概括按钮停用。

## 上游

Agent-Reach 1.6.0（MIT）参照提交 `14c213405669414492bda0f8d52cc6531d062c45`。正文提取依赖的许可见 `notices/`。
