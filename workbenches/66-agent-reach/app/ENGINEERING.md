# Agent-Reach 工程说明（0.9.0）

## 模块

| 路径 | 职责 |
| --- | --- |
| `src/server/reach/result.ts` | 上游 `runtime/result.py` 的信封、错误代码与 `classify`（网络错误映射为中文 NETWORK/TIMEOUT，不暴露 “fetch failed”） |
| `src/server/reach/net.ts` | 公网读取：`normalizePublicUrl`（上游 `utils/url.py` 移植）、`isPublicAddress`（net.BlockList，含 IPv4 映射/NAT64）、在套接字 `lookup` 内检查 DNS 结果、逐跳重定向复核、超时、解压后体积上限、类型白名单、charset 解码、`HTTPS_PROXY`/`HTTP_PROXY`/`NO_PROXY`（CONNECT 隧道，代理模式下先本地解析检查；Clash fake-ip 198.18/15 在代理模式放行） |
| `src/server/reach/github.ts` | `channels/github.py` 的 `_read/_search`，只走匿名 REST，不读 gh / 环境变量 token / Config |
| `src/server/reach/v2ex.ts` | `channels/v2ex.py` 的 hot/node/read |
| `src/server/reach/web.ts` | `channels/web.py`：Jina 读取与反爬页识别、Exa `web_search_exa` JSON-RPC 与文本块解析；新增直接读取（linkedom + @mozilla/readability，正文转纯文本保留标题/列表/段落，失败退回去导航后的 body 文本） |
| `src/server/reach/collect.ts` | 渠道/动作校验与调度，返回 `schema_version:1` 信封；网页阅读记录 Jina/直接读取每次尝试 |
| `src/server/collector.ts` | 路由：`GET /api/collector/status`、`POST /api/collect`（最多 3 个并发）、`GET /api/host/status`、`POST /api/summarize`（Host `llm.generateText`，HOST_NOT_CONNECTED → 503） |
| `src/contracts/research.ts` | 信封/采集/项目校验、去重、合并、Markdown 报告；项目 880KB、工作稿 1.5MB |
| `src/contracts/channels.ts` | 渠道与动作目录（服务端校验和界面共用） |
| `src/contracts/summary.ts` | 概括材料（每来源正文前 6000 字 + 笔记 + 摘录，最多 8 条）、请求校验、提示词、工作稿内的草稿解码 |
| `src/contracts/sample.ts` | 首次打开的示例调研：2026-10-29 由本采集器取得的真实结果（sqlite.org 公有领域文档、sqlite-wasm README Apache-2.0、Exa 搜索摘要） |
| `src/ui/useResearchDesk.ts` | 资料桌状态：采集、收件区、收藏、摘录、审阅、导入导出 |
| `src/ui/useSummary.ts` | 可选模型概括状态 |
| `src/ui/App.tsx` 等 | 文件条、左目录（Collector/Inbox/SourceList）、中原文（Reader，摘录高亮）、右摘录夹（Folder）、调研菜单与原生 JSON 对话框（FileMenu/Dialog） |

## 数据

数据表与迁移不变（`projects`、`autosave_drafts`）。项目 payload 仍是 `Collection {input, captures, sources, selected, brief}`；`input.action` 新增 `fetch`、`search`（网页）取值，旧数据兼容。新增的工作稿字段都在 extra：`summary`、`summaryPick`、`summaryFocus`，随自动保存、完整项目导出和导入保留。appId 与 storageKey `agent-reach-sources-v1` 不变。

## 外部效果

只在 `POST /api/collect` 时访问对应公网主机；`/api/summarize` 只在用户点击生成时调用 Host 模型；`/api/host/status` 只在用户点击检查时调用。删除了 0.5.0 的 Python 服务（`service/`）。

## 验证

`pnpm workbench check|test|package agent-reach`；测试覆盖地址过滤、URL 规范化、DNS 后拒绝、重定向复核、类型/体积/超时/gzip/charset、HTTP 代理转发、各渠道解析与错误映射、Jina→直接读取回退、Exa JSON-RPC、Readability 提取、示例调研有效性与报告、概括材料与导入保留。
