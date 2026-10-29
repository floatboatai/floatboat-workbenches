# DeerFlow 0.9.0 验收

2026-10-29，Node 22.22.0、pnpm 10.22.0、Chrome for Testing（playwright-core 1.57.0，headless）。预览以 `FLOATBOAT_HOST_MODE=offline` 运行，检索指向本机夹具 `RESEARCH_FIXTURE_ORIGIN`，DeerFlow 地址在页面上设置为本机 Gateway 合同夹具。**没有调用真实 Floatboat Host、任何模型、真实 DeerFlow 部署或外网检索。**

## 之前 → 现在

| 之前（0.5.1） | 现在（0.9.0） |
| --- | --- |
| 核心动作需要完整 DeerFlow 部署，未配置时提交与同步禁用，从未实测 | 无任何服务即可完成整份研究：模板计划 + Node 内置检索（网页直读/Readability、Jina 回退、Exa 搜索、GitHub）+ 本地底稿 + 报告编辑器 + 导出 |
| 没有计划概念，只有一段简报 | 可编辑计划（4 种步骤、增删排序）、人工确认、修改后需重新确认；Floatboat 模型计划建议（可选） |
| 报告为纯文本框，来源与报告无关联 | 来源稳定编号，`[n]` 引用跳转、插入引用、引用检查、被引来源核验后才能交付；Markdown/HTML 导出 |
| DeerFlow 每 5 秒轮询；地址只能用环境变量；连接失败显示原始错误 | 页面设置地址、“重新检查”读取模型列表、就地启动方式；官方运行事件流（SSE）+ Last-Event-ID 续接，页面 EventSource 实时进度；连接错误给出 ECONNREFUSED 等下一步 |
| 原生会话 650KB / 300 条消息上限 | 导入 ≤8MB、3000 条消息，超出项目容量自动压缩并标记 |
| 示例是未运行的示例会话 | 已完成的原创研究：SQLite WAL 选型，7 步计划、7 项已核验来源、约 1250 字带配置表的报告 |
| 页头：项目下拉 + 新建/导入/完整项目 | “研究”文件菜单 + 三阶段进度；工作区 + 来源证据栏 |

## 功能验收：local-verified

### 构建与测试
- `pnpm workbench check deerflow`：manifest、锁文件、类型与构建通过（仅保留共享 autosave-client 体积提示）。
- `pnpm workbench test deerflow`：53 项通过（之前 19 项）。新增覆盖：模板计划/确认规则/模型计划校验、DeerFlow 简报、检索合并保持编号与备注、本地底稿、Markdown/HTML 导出与转义、v1 升级、引用解析与交付门禁、示例完整性、大会话压缩；检索夹具（直读、Jina 回退、GitHub README、404/PDF 错误码、Exa 结果与私网结果丢弃、GitHub 限额说明、ECONNREFUSED）、SSRF（回环/链路本地/内网名/映射地址/DNS 解析后拒绝）、代理选择；mock Host 合同（状态、`generateObject` 计划、`generateText` 报告与编造编号、离线 503）；SSE 解码、帧摘要、断线后按 Last-Event-ID 续接且不重复 POST、gap 改读完整状态、反复失败暂停、页面事件流回放与收尾、`/api/models` 检查与授权/拒绝连接说明、地址配置；自动保存提交幂等、未完成网址草稿、冲突保护。原有运行账本测试（持久命令、丢回执只读恢复、模型白名单拒绝、地址变更保护、官方载荷与幂等键）全部保留。
- `pnpm package`：`artifacts/deerflow-studio-0.9.0.fbworkbench`，72 个文件，不含业务数据，SHA-256 `006357c78f72cd113a6c88944e6dfe364f16b481d14d696a72a4192361e28639`。

### 真实浏览器（空数据目录，1440×900）——55 项检查全部通过
1. 首屏为已完成示例，页面加载只请求本机 API；导出 Markdown（参考来源 [1]–[7]）与独立 HTML（表格、`#source-n` 锚点）并核对文件内容；点击报告中的 [4] 定位并展开来源 [4]。
2. 研究菜单 → 新研究 → 写问题与范围（含 3 个网址）→ 按模板生成 5 步 → 改 GitHub 检索词 → 确认计划（标题自动取自问题）→ 执行 3 个检索步骤：网页检索 2 项、GitHub 2 项、精读 3 个网址中脚本页经 Jina 回退成功、缺失网址显示 `NOT_FOUND` 说明；来源 5 项编号进入右栏；记录发现并标记人工步骤完成。
3. 确认后修改步骤检索词，计划回到“待确认”。
4. 汇编本地底稿 → 插入引用 [1] → “完成复核”被未核验引用阻止 → 核验被引来源 → 可交付 → 导出 Markdown；刷新后状态恢复。
5. Floatboat 离线：起草按钮旁显示“未连接 Floatboat…重新检查”，模板与底稿照常可用。
6. DeerFlow：未设置时显示启动方式与不可提交原因；填写未启动的端口显示 ECONNREFUSED 说明（无 fetch failed）；填写合同夹具后“已连接”并列出 2 个模型；提交后事件日志实时出现，夹具在第 3 帧主动断线，服务端以 `Last-Event-ID: 2-0` 续接直至“事件流结束”；夹具日志确认只有 1 次线程 POST 与 1 次运行 POST（带幂等键）；载入结果后来源并入（DeerFlow 2 项），采用最新答复进入报告；刷新后研究记录与事件仍在。
7. 自动保存：第一次保存延迟 2.5 秒期间继续输入，刷新后完整；服务端已提交但回执丢失，显示“草稿已暂存本机”并自动重试，项目数不变；来源网址填 `https://` 显示为草稿，刷新后原样恢复；导出完整项目再导入成为新研究（项目数 +1）；坏 JSON 提示“JSON 语法有误”；研究菜单 Escape 关闭且焦点回到按钮。
8. 无非预期 console 错误（唯一一条是测试故意中断回执产生的 `ERR_CONNECTION_RESET`）。

### 375×812
报告、计划、执行、DeerFlow 面板均无横向溢出；“工作区 / 来源”切换；点击引用自动切到来源并定位；研究菜单全屏可用；无 console 错误。

测试脚本、夹具与截图保存在 `archive/2026-10-29-workbench-depth/deerflow/`，不入库。

## 结构审查：passed（改版后真实截图）
- 去掉“项目下拉 + 新建/导入/完整项目”页头；文件生命周期全部在“研究”菜单；顶栏是研究名、三阶段进度与唯一主动作“导出报告”。
- 主工作区随阶段变化（计划编辑 / 执行卡片 / 报告纸面），来源证据栏固定在右侧与引用互相跳转；主操作紧贴对象。
- 与 Agent-Reach（目录—原文—摘录夹）、Oasis（居中单纸张）对照：本工作台以研究流程为骨架，报告与来源以编号联动。
- 截图：`docs/screenshots/deerflow.png`（1440×900，示例研究报告分栏，来源 [1] 已展开）。

## Web Interface Guidelines
App/PlanStage/ExecuteStage/DeerFlowPanel/ReportStage/SourcesPanel/FileMenu/style.css 自查：图标按钮均有 aria-label；分段控件用 aria-pressed；阶段导航 aria-current；表单字段有 label/name，网址与代码输入关闭拼写检查；占位文字以“…”结尾；状态用 role=status，事件日志 aria-live；删除与替换正文需确认；对话框 Escape、焦点循环与返回；滚动区 overscroll-behavior: contain；reduced-motion 关闭动画与平滑滚动；禁用按钮旁写明原因。未逐条拉取最新版规则（验收不访问外部服务）。

## 未覆盖与限制
- 真实 Floatboat Host 未测：模型计划与报告草稿只经 mock Host 合同测试。
- 真实 DeerFlow 部署未测：只验证官方源码中的接口形态与本机合同夹具；`verify_run_contract.py` 已加入 `stream_mode`，本轮未重新运行（需要上游源码目录与 Pydantic 环境）。取消、人工确认、恢复中断仍在 DeerFlow 处理；产物原件不下载。
- 外网检索未在验收中调用：Exa/Jina/GitHub 的解析按 Agent-Reach 0.9.0 已实测的格式实现，并用本机夹具验证；Exa 免费额度、Jina 可用性与 GitHub 匿名限额取决于外部服务。网页直读不执行脚本；PDF 等非网页不读取。
- DeerFlow 完成后本地计划步骤状态不会自动标记；两个通道的步骤进度分别记录。
- 页面事件流为 50 秒轮换连接（EventSource 自动续接）；预览热重载会等待在途连接。
- IndexedDB 恢复限同一浏览器来源；Floatboat 客户端导入 `.fbworkbench` 未实测。

## 收尾复核

2026-10-29 重新运行 check 与 53 项应用测试通过。更新安装包，使包内 REQUIREMENTS.md、DESIGN.md、ENGINEERING.md 与最终源码一致；逐文件核对代码和文档，资源声明按模板打包规则规范化。原包留存于本地验收归档。
