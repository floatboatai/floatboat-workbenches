# 安装与服务配置

本指南随工作台源码包附带。仓库级命令在[完整仓库](https://github.com/floatboatai/floatboat-workbenches)中执行，外部服务源码与锁文件位于对应项目目录；普通工作台包不包含服务运行环境。

# 调研资料台 · Agent-Reach

从公开来源出发，检索或读取资料，按链接去重收藏，核对正文、留下原文摘录与研究笔记，导出带来源的调研报告。原始Agent-Reach结果完整保留，可随时导出。


## 启动

```sh
pnpm workbench prepare agent-reach
pnpm workbench dev agent-reach
```

另开终端启动公开渠道适配服务：

```sh
cd workbenches/66-agent-reach
uv venv .local/python --python 3.12
uv pip install --python .local/python/bin/python -r service/requirements.lock.txt
.local/python/bin/python service/server.py --port 8783
```

默认连接`http://127.0.0.1:8783`；工作台服务可通过`AGENT_REACH_SERVICE_URL`配置loopback HTTP或HTTPS地址。Node同源路由调用Python服务；浏览器不直接访问该端口。服务未连接时资料、笔记和导出仍可用，采集按钮明确禁用。

## 已接入

- **GitHub**：公开仓库/Issue读取、仓库搜索。使用真实上游渠道解析，HTTP传输改为匿名公开REST，不读取`gh`或浏览器凭据。
- **公开网页**：真实上游Jina阅读。输入的公开URL会提交给Jina，请只填写可公开链接。
- **V2EX**：公开热门主题、主题读取和节点浏览。
- **原生结果导入**：支持Agent-Reach `schema_version:1`结果，包括自行取得的其他渠道结果；这是离线资料导入，不代表该渠道已接入在线采集。

搜索与读取的结果先进入收件区，再由用户选择收藏。URL去除片段和常见跟踪参数后去重，已有笔记不被新采集覆盖。每条来源可设未核对/已核对/待跟进状态；摘录必须是保留正文中的原文，不能凭空添加“引用”。

原生JSON导出保留信封、meta、raw与原文；Markdown报告包含出处、采集时间、审阅状态、摘录与评论。完整项目另含查询、选中来源、研究小结和每条来源独立的未完成摘录/JSON工作稿。

## 保存与恢复

自动保存到工作台SQLite，并在当前浏览器保留恢复稿。保存失败可重试，版本冲突需明确读取服务器版或先导出本机稿。导入完整项目或“导出工作稿”文件均创建新项目，优先保留最新snapshot和全部extra；旧未确认采集操作转为历史，不自动执行。切换项目期间锁定编辑；旧采集结果不会覆盖新项目。

每个原生信封最多500KB，项目最多100来源/50批采集及700KB；一条来源最多20摘录。超限明确报错，不静默删内容；可导出归档后开始新项目。工作稿恢复预算高于正式项目，避免总容量临界时丢失未完成编辑。

需要登录的X、小红书、YouTube账号等渠道未接入；不执行上游install/login/doctor/browser-session操作，不承诺绕过限流或平台验证。渠道失败显示上游错误与重试入口。本工具不使用模型，没有默认LLM或提供方密钥配置。

## 检查与交付

```sh
pnpm workbench check agent-reach
pnpm workbench test agent-reach
# 使用上面创建的解释器运行：
.local/python/bin/python -m unittest discover -s service -v
pnpm workbench package agent-reach
```

前三条pnpm命令从总仓库根目录执行；Python测试从本项目目录执行。

`.fbworkbench`为独立工作台源码包，导入路径：Floatboat → 我的 → 工作台 → 导入工作台。包不含Python环境、预览数据库、采集资料或凭据；Python服务按本仓库项目目录另行启动。客户端源包导入尚未实测。验证证据见[ACCEPTANCE.md](https://github.com/floatboatai/floatboat-workbenches/blob/main/workbenches/66-agent-reach/ACCEPTANCE.md)。

上游：[Panniantong/Agent-Reach](https://github.com/Panniantong/Agent-Reach)，MIT许可，锁定1.6.0提交`14c213405669414492bda0f8d52cc6531d062c45`。许可随源码包作为只读资源保留。
