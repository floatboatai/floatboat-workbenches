# 抓取观测 · GEOInflow

把网站访问日志与内容清单放在同一张审计账本中，核对 AI 爬虫声明、HTTP 错误、引荐来源和待处理页面。直接使用 GEOInflow 原生分类核心；数据在本地处理，无需模型或独立服务。

![抓取观测](../../docs/screenshots/geoinflow.png)

## 使用

从总仓库运行 `pnpm workbench prepare geoinflow` 和 `pnpm workbench dev geoinflow`。打开示例站点熟悉账本，或新建站点并填写域名；“导入观察资料”接受 JSON/Combined 日志以及 JSON/CSV/Sitemap URL 清单。先解析，检查有效记录与错误，再明确采用；有错误的原始输入继续保留。输入改变后必须重新解析，旧候选不能覆盖新内容。

日期、统计时区、来源、用途与 HTTP 筛选同时作用于数字、表格和 CSV 导出。选择页面查看原始 UA 证据，填写负责人、处理状态和处理记录。没有内容清单时不计算覆盖率。日期未完成时按草稿保存，不显示误导性统计。

名称、筛选、审阅记录、未应用来源文本和 JSON 均自动保存。完整项目或“恢复”菜单下载的恢复稿都可导入为新项目；导入不会覆盖原项目。冲突时导出本机恢复稿或明确读取服务器版本。浏览器本机恢复限定同一来源。

## 实际范围

- 上游固定为 `9eb3aefc5a3fa8d4be8026fe468d6927cd017ed4`，使用 HTTP UA 分类、AI 引荐域名目录与严格日期解析；来源及少量类型/路径适配哈希见 `UPSTREAM.json`。
- UA 与 Referer 是请求中的声明，未做 IP/DNS 身份认证。观察到访问不能证明被收录、训练或被模型回答引用。
- 每项目最多 200 条日志、200 个页面、100 条处理记录。正式项目最多 650KB；更大的有效结构工作稿仍可恢复，恢复预算为 1.3MB。来源文本最多 20 万字符及 550KB，超限明确拒绝。
- 当前实现是有边界的本地观察与复核流程；不包含上游在线采集部署、站点管理后台或付费服务。
- 示例日志是自制普通资料，不是真实站点流量；所有标识与统计均从这些导入记录计算。

## 验证与导入

本目录运行 `pnpm workbench:check`、`pnpm test` 和 `pnpm package`。证据见 [ACCEPTANCE.md](ACCEPTANCE.md)。从 Floatboat 的工作台导入入口选择 `.fbworkbench`；客户端导入尚未实测。

上游：[GEOInflow](https://github.com/yaojingang/GEOInflow)，MIT，许可随包保留。
