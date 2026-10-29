# 调研资料台 · Agent-Reach

一张“目录—原文—摘录夹”的资料桌：从公开网页、GitHub 和 V2EX 采集来源，按链接去重收藏，阅读保留的原文，把逐字一致的句子摘进摘录夹并写下判断，最后导出带出处的 Markdown 调研报告。

![调研资料台](../../docs/screenshots/agent-reach.png)

## 启动

```sh
pnpm workbench prepare agent-reach
pnpm workbench dev agent-reach
```

不需要另起服务。采集由工作台自己的 Node 服务完成；首次打开就是一份真实的示例调研「浏览器端 SQLite 持久化选型」（4 条来源、6 条摘录、审阅状态和研究小结），可以直接阅读、摘录和导出。页面加载时不会访问任何外部网站。

## 采集渠道

全部由用户点击「采集」触发，结果先进入收件区，勾选后才收藏。渠道与解析移植自 Agent-Reach 1.6.0（`channels/github.py`、`web.py`、`v2ex.py`、`runtime/result.py`），输出同样的 `schema_version:1` 结果信封。

| 渠道 | 动作 | 上游路径 |
| --- | --- | --- |
| 网页 | 阅读网页 | Jina Reader（`r.jina.ai`），失败时自动改为直接读取；每次尝试记录在 `meta.attempts` |
| 网页 | 直接读取 | 工作台直接请求网页，用 Mozilla Readability 提取正文，不经第三方 |
| 网页 | 网页搜索 | Exa 免密钥公开搜索（上游 `web search` 使用的 `mcp.exa.ai`） |
| GitHub | 仓库 / Issue / PR | 匿名公开 REST：仓库含 README（前 5 万字），Issue/PR 含前 50 条评论 |
| GitHub | 搜索仓库 | 匿名公开 REST，前 5 项 |
| V2EX | 主题与回复、节点最新、今日热门 | V2EX 公开 API |

安全边界：只接受不含登录信息的 http(s) 链接；拒绝 `localhost`、`.local/.internal` 等名称和私网/回环/链路本地/组播字面地址；主机名在**解析之后**再检查地址，并在套接字连接时使用同一次检查结果；每次重定向（最多 5 次）都重新检查。读取有超时（12–25 秒）、5MB 响应上限、网页类型白名单（HTML、XHTML、纯文本、Markdown）；正文超过 8 万字时保留前 8 万字并标注。所有正文按纯文本呈现，不渲染远程 HTML。

代理：启动工作台前设置 `HTTPS_PROXY` / `HTTP_PROXY`（仅 `http://` 代理）与 `NO_PROXY`，采集会经代理隧道发出；使用代理时仍先在本机解析并检查目标地址。无网络时显示 `NETWORK` 错误与具体原因，不出现 “fetch failed”。

未接入：需要登录或浏览器会话的渠道（X、小红书、Reddit 等，上游走 OpenCLI 浏览器）。这些结果可以在其它地方取得后，作为 Agent-Reach 原生 JSON 导入。

## 资料桌

- **左栏**：采集条、收件区（标出“已在目录”的重复来源并默认不勾选）、按审阅状态筛选的资料目录。
- **中栏**：来源原文，已保存的摘录在正文中以琥珀色标出；选中文字后「摘录选中文字」；未核对 / 已核对 / 待跟进；来源判断笔记；导出该来源的原生结果。
- **右栏**：摘录夹（摘录必须与原文逐字一致，可“在原文中定位”）与研究小结。
- **「调研」菜单**：新调研、打开示例、最近调研、导入（完整项目、恢复稿、Agent-Reach 原生 JSON）、导出完整项目、编辑原生 JSON、下载恢复稿、删除。右上角只有「导出报告」。
- 375px 宽度下切换为「目录 · 原文 · 摘录夹」三段视图。

## 可选：模型概括

研究小结页可把勾选来源（最多 8 条）的笔记、摘录和正文开头交给 Floatboat 模型（`manifest.capabilities: ["llm"]`），生成带［编号］的要点草稿；草稿保存在工作稿中，需手动「插入研究小结」，插入时注明模型与“未经人工核对”。只有点击「检查连接」后才联系 Host；没有 Floatboat 时按钮停用并显示启动提示，其余功能不受影响。

## 保存、导入与导出

自动保存到工作台 SQLite，并在浏览器 IndexedDB 保留恢复副本：采集条输入、收件区与勾选、每条来源的未完成摘录、未应用的原生 JSON、模型概括草稿都会恢复。导入总是新建调研，旧的未完成采集只记入导入记录、不会自动重发。

- Markdown 报告：来源数与审阅统计、研究小结、每条来源的链接/作者/渠道/采集时间/审阅状态、判断笔记、编号摘录与说明。
- 完整项目 JSON：原生结果信封、人工层与全部未完成输入。
- 原生结果 JSON：与采集时完全一致的 Agent-Reach 信封。

容量：每次采集结果 500KB；每份调研 100 条来源、50 批采集、880KB（平台单项目上限 900KB）；每条来源 20 条摘录。超限会明确报错，可导出归档后新建调研。

## 检查与交付

```sh
pnpm workbench check agent-reach
pnpm workbench test agent-reach
pnpm workbench package agent-reach
```

`.fbworkbench` 为独立源码包（Floatboat → 我的 → 工作台 → 导入工作台），不含预览数据库、采集资料或凭据。客户端源包导入尚未实测。验证证据见 [ACCEPTANCE.md](ACCEPTANCE.md)。

上游：[Panniantong/Agent-Reach](https://github.com/Panniantong/Agent-Reach)，MIT，参照提交 `14c213405669414492bda0f8d52cc6531d062c45`（许可见 `app/notices/`）。正文提取使用 `@mozilla/readability` 0.6.0（Apache-2.0）与 `linkedom` 0.18.13（ISC），依赖许可见 `app/notices/server-dependencies-LICENSES.md`。
