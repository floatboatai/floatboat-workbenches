# 深度研究工作台配置

## 不需要任何配置即可使用

本地检索在工作台的 Node 服务内运行，只在用户点击执行时访问公网：

- 网页直读（Readability 提取正文），失败时经 `r.jina.ai` 阅读；
- 网页搜索经 Exa 公共 MCP 端点（免密钥，有限额）；
- GitHub 公开 API（未登录每小时 60 次；可在服务端设置 `GITHUB_TOKEN` 提高限额）。

本机、内网、链路本地地址和带登录信息的网址一律拒绝；系统 `HTTPS_PROXY`/`HTTP_PROXY`（http 代理）与 `NO_PROXY` 会被使用。

## 可选：Floatboat 模型

启动 Floatboat 桌面端后，“用 Floatboat 模型起草”可生成计划建议与报告草稿。未连接时按钮旁显示状态，点“重新检查”即可。模型只依据所给来源写作，草稿中不存在的引用编号会被标出。

## 可选：DeerFlow 服务

1. `git clone https://github.com/bytedance/deer-flow.git && cd deer-flow`
2. `make setup`：选择模型与搜索工具，生成 `config.yaml` 与 `.env`
3. `make docker-init && make docker-start`，默认地址 `http://localhost:2026`
4. 在“执行研究 → DeerFlow 服务”填写地址并“保存并检查”；或在工作台服务端设置 `DEERFLOW_URL`（优先于页面设置）。远程地址须 HTTPS。启用访问令牌时设置服务端 `DEERFLOW_TOKEN`，令牌不进入浏览器、项目或导出文件。

提交使用官方 `POST /api/threads`、`POST /api/threads/{id}/runs`（`stream_mode: ["values","updates"]`、`on_disconnect: continue`、`Idempotency-Key`），进度来自 `GET /api/threads/{id}/runs/{run_id}/stream`（只读观察，断线携带 `Last-Event-ID` 续接；`gap` 时改读完整状态），结果读取 `GET /api/threads/{id}/state`。模型名称须在部署白名单中，会消耗 DeerFlow 侧配额。取消、人工确认与恢复中断请在 DeerFlow 处理。

## 离线验收夹具

`RESEARCH_FIXTURE_ORIGIN=http://127.0.0.1:<port>` 把 GitHub/Exa/Jina 端点指向本机夹具，并只放行该回环来源；仅用于验收，生产环境不要设置。

## 容量

单项目 850KB；来源最多 150 项，每项保存正文前 6000 字；计划最多 12 步；原生会话导入 ≤8MB，超过 450KB 的会话保留最新检查点并截短长内容（标记 `floatboat_compacted`）。
