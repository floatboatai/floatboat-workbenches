# AI 研究、知识与结构化数据工作台候选

核验日期：**2026-10-27**。本轮调查 9 个官方 GitHub 项目，覆盖文档理解、结构化抽取、知识图谱、研究报告、资料笔记、企业检索和语义 BI。只读取官方源码、文档、许可证和 GitHub API；**没有安装或运行上游，没有调用真实模型，也没有完成 Floatboat/Host/CSP 验收**。下文的工作流、布局、优先级和工期均为工程推断；接口存在不等于已验证兼容。

建议首轮选 **Docling、LangExtract、LightRAG**。三者分别解决“文档变成可校对结构”“文本变成有证据的记录”“知识关系与检索结果可解释”，比增加一个聊天入口更能形成独立工作台。GPT Researcher 的研究报告方向同样有价值，但需先厘清许可证元数据冲突。WrenAI 发生了产品与架构转向；旧版聊天 BI 已明确停止功能和安全修复，应降级为后续语义引擎接入候选，不能沿用旧教程立项。[WrenAI 当前说明](https://github.com/Canner/WrenAI/blob/main/README.md)

## 接入前提

本仓库的已知约束是 Node 22、React 19、SQLite、纯 JS 服务端，以及 `script-src 'self'`、`connect-src 'self'` 的固定 CSP。Python、Rust/Go 原生运行时、数据库集群和模型推理进程不属于工作台包；九项均应采用**外部核心服务/后端＋同源 Node 连接器＋原生工作台 UI**。它们不是九个可直接安装的 React 组件。

- 前端只访问工作台同源路由；Node 连接器访问预先配置的上游地址，管理鉴权、超时、错误映射和任务状态。不是让浏览器直连云端、localhost 另一端口或任意用户输入 URL。
- SQLite 保存项目、输入快照、上游任务 ID、结果版本、人工修订和导出记录；原始文件与大型结果做附件。上游负责向量索引、图谱、OCR/模型执行；不要把数据库名称替换成 SQLite 就宣称完成移植。
- Host 有 LLM/Agent/ASR 能力，但本地当前断开。上游所需的 embedding、reranker、搜索服务、TTS、Python provider SDK 或 OpenAI-compatible HTTP endpoint，不能从“Host 有 LLM”自动推出。需要逐项验证协议、结构化输出、流式事件与模型能力。
- 保存完整草稿、任务恢复和证据引用是工作台自建能力。生成结果覆盖人工改动、重复提交形成重复索引、来源失效后引用无法还原，都是首版要处理的产品问题。
- 表中工期是**外部服务已可用、单人全职、一个明确流程**的预估人日，含原生 UI、持久化、错误状态与小范围验收，不含采购、集群运维、多租户改造、全量上游功能移植。P0 表示值得先验证，并非可立即发布。

## 候选概览

| 优先级 | 项目 | 建议工作台 | 复用方式 | 预估工作量 | 首要约束 |
| --- | --- | --- | --- | --- | --- |
| P0 | Docling | 文档结构与表格校对台 | Python 文档核心，经官方 REST 服务接入 | 7–12 人日，中 | OCR/模型在外部；保留页码与结构引用 |
| P0 | LangExtract | 证据字段抽取与人工复核台 | Python 抽取核心，自建薄服务 | 6–10 人日，中 | 不是 OCR；原生 HTML 不符合当前脚本 CSP |
| P0 | LightRAG | 知识图谱与检索质量检查台 | 既有 REST/图谱 API 后端适配 | 10–18 人日，中高 | LLM＋embedding；生产存储不应照搬测试默认值 |
| P1 | GPT Researcher | 研究任务、来源核查与报告台 | Python SDK 核心＋任务服务 | 10–18 人日，中高 | 长任务与搜索费用；LICENSE/包元数据不一致 |
| P1 | Open Notebook | 多资料阅读与知识卡片台 | 完整后端 REST 适配 | 12–20 人日，中高 | Python＋SurrealDB；共享密码不是组织权限体系 |
| P1/P2 | WrenAI | 指标口径、SQL 与结果审查台 | 当前 Python/Rust 语义核心，外部服务封装 | 18–30 人日，高 | 旧版停止维护；WASM 与当前 CSP 不相容 |
| P2 | RAGFlow | 文档入库、切片与召回复核台 | 完整外部 RAG 服务适配 | 15–25 人日，高 | 当前主线 Go/native 服务；依赖多，API 正在迁移 |
| P2 | Onyx | 企业检索证据与连接器巡检台 | 已部署企业知识后端 REST/MCP 适配 | 15–25 人日，高 | CE/EE 边界、用户权限和外部系统账号 |
| P2 | Khoj | 私人文档语义检索与证据收藏台 | 已有个人知识后端 API 适配 | 12–20 人日，中高 | AGPLv3；活跃度较其余候选低，功能容易与 Host 重叠 |

## 1. Docling：文档结构与表格校对台

**官方仓库**：[docling-project/docling](https://github.com/docling-project/docling)。核心是把 PDF、Office 文档、图像等转换成统一的 `DoclingDocument`，包含版面、阅读顺序、表格结构和 OCR；可导出 Markdown 与无损 JSON。它提供 `DocumentConverter().convert()`，并有独立的 `docling-serve` HTTP 服务。[README](https://github.com/docling-project/docling/blob/main/README.md)

**原生流程与布局（建议）**：扫描 PDF/研究报告/产品手册 → 解析 → 校对标题层级、阅读顺序、表格与遗漏 → 输出 Markdown、结构 JSON 和表格数据。左侧是文件/页缩略图，中间是原页与选区，右侧是结构树及可编辑表格；上下文操作围绕“这块内容解析对了吗”。首版限定 PDF 与图片，人工编辑保存为单独修订层，不声称修改了上游解析模型。

**真实接口与边界**：官方文档列出 `POST /v1/convert/file/async`、`GET /v1/status/poll/{task_id}`、`GET /v1/result/{task_id}`，服务可设置 `X-Api-Key`，运行时 `/docs` 提供 OpenAPI。Node 转交文件、轮询任务、持久化 `json_content` 和 `md_content`；页面定位与编辑器由工作台实现。应区分 `success`、`partial_success` 与 `failure`，不能把部分解析成功显示成完整完成。[REST API](https://github.com/docling-project/docling/blob/main/docs/usage/api_server/rest_api.md)

**部署**：Python 3.10+；可独立 Python 进程或 Docker，模型需提前下载。官方部署文档区分 CPU 与 CUDA 镜像、同步/异步计算及多 worker 方案；GPU 取决于所选 OCR/VLM 和吞吐目标，并非所有转换都强制需要 GPU。首版外部 CPU 服务可作为验证起点，真实耗时尚未测量。[Python 要求](https://github.com/docling-project/docling/blob/main/README.md#quickstart)、[服务部署](https://github.com/docling-project/docling/blob/main/docs/usage/api_server/deployment.md)

**许可**：Docling 与 docling-serve 均为 **MIT**。模型不是统一继承 MIT：官方明确要求逐个核对模型许可证；例如 IBM 官方 `granite-docling-258M` 模型卡是 **Apache-2.0**。本方案未选定其他 OCR/VLM 权重，也未审核其再分发条件；首版不在工作台包内附带权重。[Docling LICENSE](https://github.com/docling-project/docling/blob/main/LICENSE)、[服务 LICENSE](https://github.com/docling-project/docling-serve/blob/main/LICENSE)、[模型许可说明](https://github.com/docling-project/docling/blob/main/README.md#license)、[Granite 模型卡](https://huggingface.co/ibm-granite/granite-docling-258M)

**判断**：P0，7–12 人日。第一个验收样本应是包含扫描页与跨页表格的真实报告，验证原页定位、部分失败、人工修订重开和 JSON/Markdown 导出。视觉 PDF 查看组件本身也需遵循当前 CSP，不能在这份研究中默认其任意构建都可用。

## 2. LangExtract：证据字段抽取与人工复核台

**官方仓库**：[google/langextract](https://github.com/google/langextract)。它依据提示、few-shot 示例或输出 schema 抽取结构化信息，给抽取项附上原文字符区间，支持长文本分块、多轮抽取和 JSONL。定位失败的项可能出现 `char_interval = None`，原文定位不是“模型事实一定正确”的保证。[README](https://github.com/google/langextract/blob/main/README.md)、[输出 schema 文档](https://github.com/google/langextract/blob/main/docs/examples/output_schema.md)

**原生流程与布局（建议）**：招投标条目/客户访谈/研究文献正文 → 定义字段及示例 → 批量抽取 → 点击单元格回看原文 → 接受、修正或拒绝 → 导出 CSV/JSONL。左侧字段与示例，中间是高亮原文，右侧是抽取记录表，底部是批次和失败项。可以与 Docling 的文本结果衔接，但 LangExtract 本身不是扫描件 OCR 或 PDF 版面解析器。

**真实接口与边界**：Python `lx.extract()`、`lx.io.save_annotated_documents()` 是已确认的复用入口，未发现由这个核心仓库承诺维护的通用生产 REST 服务；需自建有任务 ID 的薄服务。核心支持 provider 插件，但 Host 接入仍需实现并验证对应 provider 协议，不能只替换一个提示词就标成已集成。[调用示例](https://github.com/google/langextract/blob/main/README.md#quick-start)、[官方 provider 插件示例](https://github.com/google/langextract/blob/main/examples/custom_provider_plugin/README.md)

**CSP 细节**：`lx.visualize()` 的上游可交互 HTML 使用内联 `<script>` 与 `onclick`/`onchange`；当前 `script-src 'self'` 不允许照原样嵌入。应读取抽取 JSON，在 React 中重建区间高亮、记录跳转和接受/拒绝流程，使用本地打包脚本。上游输出 HTML 可以作为文件导出选项，但不能把“生成 HTML”当作工作台内可运行的组件证据。[可视化源码](https://github.com/google/langextract/blob/main/langextract/visualization.py)

**部署与许可**：Python **3.10+**，核心 **Apache-2.0**。云端模型需要对应账号/key；也可连接 Ollama，本地模型的内存/GPU 和权重许可取决于模型。核心并未赋予 Gemini/OpenAI 或其他模型服务的使用权；首版可选择已有模型服务，无需在工作台运行 GPU 推理。[包声明](https://github.com/google/langextract/blob/main/pyproject.toml)、[LICENSE](https://github.com/google/langextract/blob/main/LICENSE)、[模型接入说明](https://github.com/google/langextract/blob/main/README.md#using-local-llms-with-ollama)

当前 README 另明确：健康相关应用还受 **Health AI Developer Foundations Terms of Use** 约束；本轮建议限定为非医疗文档抽取。[README 原文](https://github.com/google/langextract/blob/main/README.md#disclaimer)、[所链接条款](https://developers.google.com/health-ai-developer-foundations/terms)

**判断**：P0，6–10 人日，适合做第一款 AI 工作台。首版采用文本输入和单一业务字段集；验收需包含中文、重复同名片段、无定位项、人工修正后重新运行，以及源文本版本变化后区间失效的处理。不要把没有原文依据的推断值悄悄混入已核实字段。

## 3. LightRAG：知识图谱与检索质量检查台

**官方仓库**：[HKUDS/LightRAG](https://github.com/HKUDS/LightRAG)。结合实体/关系图与向量检索，提供文档入库、检索和图谱浏览能力；项目既有 Python 核心也有独立 API Server/WebUI。[官方 README](https://github.com/HKUDS/LightRAG/blob/main/README.md)

**原生流程与布局（建议）**：某项目的一组文档 → 建索引 → 查看实体与关系 → 输入测试问题 → 并排比较召回片段与答案 → 标记缺失关系/噪声证据 → 导出问题集与检查报告。中心是知识关系画布，左侧是文档和入库状态，右侧是选中节点的来源片段；检索结果用底部对照表呈现。首版图谱只读，人工问题单存在 SQLite，后续再接修改/合并实体接口。

**真实接口与边界**：服务有 `/documents/upload`、`/documents/text`、`/documents/track_status/{track_id}`、`/query`、`/query/stream`；引用可请求附带检索片段内容。图路由源码还提供 `/graphs`、实体查询、编辑、关系编辑与实体合并。工作台应直接展示实际图与检索上下文；用 Host 编几个节点并画图不能算 LightRAG 集成。[API 文档](https://github.com/HKUDS/LightRAG/blob/main/docs/LightRAG-API-Server.md)、[图谱路由源码](https://github.com/HKUDS/LightRAG/blob/main/lightrag/api/routers/graph_routes.py)

**部署**：Python 3.10+，官方支持 pip/uv 与 Docker。至少配置 LLM 和 embedding，可另接 reranker；托管模型方案不要求工作台机器有 GPU。当前文档明确：默认文件持久化后端的数据主体仍在进程内存中，只适合小规模试验，生产推荐 PostgreSQL。不要把“Light”解释成可以将整套索引存入本地 SQLite。embedding 模型、维度或语义配置改变可能要求重建索引。[包声明](https://github.com/HKUDS/LightRAG/blob/main/pyproject.toml)、[存储与模型配置](https://github.com/HKUDS/LightRAG/blob/main/docs/LightRAG-API-Server.md)

**许可**：核心 **MIT**；本次根许可证没有另加 SaaS 限制。外接的模型、数据库及文档解析器保留各自条件，不能从 LightRAG 的 MIT 推出所有可选后端均可重新分发。首版限定一个已核验的服务版本与存储组合。[LICENSE](https://github.com/HKUDS/LightRAG/blob/main/LICENSE)、[可选后端清单](https://github.com/HKUDS/LightRAG/blob/main/docs/LightRAG-API-Server.md)

**判断**：P0，10–18 人日。比聊天知识库更有工作台特色，但必须拥有真实索引。先跑通“20 份文档→来源可追溯的图→5 个固定问题→召回对照→保存重开”，再讨论图谱修改和生产集群。

## 4. GPT Researcher：研究任务、来源核查与报告台

**官方仓库**：[assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher)。核心是问题拆解、搜索/抓取、多阶段研究和带来源的报告生成；可以针对网络、已有来源和本地材料研究。其多代理和深度研究能力来自真实 Python 编排，并非单次模型调用。[README](https://github.com/assafelovic/gpt-researcher/blob/main/README.md)

**原生流程与布局（建议）**：研究题目＋目标读者＋来源范围 → 审阅研究问题 → 运行研究 → 查看来源与引用 → 编辑报告 → 导出报告和证据清单。中间是报告编辑页，左侧是大纲与研究进度，右侧是引用核查抽屉；任务可以失败、重试和保留中间材料。它适合竞品分析、技术选型、供应商背景研究，而不是复刻一个通用聊天窗口。

**真实接口与边界**：SDK 给出 `GPTResearcher(...)`、`conduct_research()`、`write_report()`，以及来源、研究上下文和费用读取方法。已有服务源码包含报告存取和研究执行逻辑；首版建议围绕 SDK 封装自己的持久任务接口，避免把 Python 进程放进 Node 工作台。断线恢复、取消、并发限额及费用归属要作为适配工作，不能假设 SDK 自动满足。[SDK 文档](https://github.com/assafelovic/gpt-researcher/blob/main/docs/docs/gpt-researcher/gptr/pip-package.md)、[服务源码](https://github.com/assafelovic/gpt-researcher/blob/main/backend/server/app.py)

**部署**：当前 Python 要求为 **3.12+**。典型配置使用 LLM 与搜索提供商，例如 README 的 OpenAI/Tavily；抓取、搜索、可选浏览器和本地模型运行均在外部服务。使用远程模型不强制需要 GPU，但需要服务账号、网络访问和调用预算。[安装与配置](https://github.com/assafelovic/gpt-researcher/blob/main/README.md#quickstart)、[Python 声明](https://github.com/assafelovic/gpt-researcher/blob/main/pyproject.toml)

**许可必须单独处理**：当前根 `LICENSE` 是 **Apache-2.0**，但 `pyproject.toml` 的 Poetry 与 project 元数据仍写 **MIT**。这是本轮读取到的实际冲突，不能挑选较短标签后宣称已完成许可核验。应在实施时固定源码提交/发行包、检查包内许可证并确定分发依据；研究暂按根源码 Apache-2.0 记录，不把它当成双重许可授权。模型/搜索服务条款与网页材料权利也独立存在。[根 LICENSE](https://github.com/assafelovic/gpt-researcher/blob/main/LICENSE)、[冲突元数据](https://github.com/assafelovic/gpt-researcher/blob/main/pyproject.toml)

**判断**：P1，10–18 人日。许可证依据明确后可提升优先级。先验证一个来源有限、成本可控的研究任务，确认输出报告与源链接是真实返回，且编辑后的报告可以保存重开。只让 Host 写一篇类似报告，不应挂牌为 GPT Researcher 工作台。

## 5. Open Notebook：多资料阅读与知识卡片台

**官方仓库**：[lfnovo/open-notebook](https://github.com/lfnovo/open-notebook)。围绕 notebook 管理来源、笔记、来源洞察、检索、转换与播客生成；目前是 Python/Next.js/SurrealDB 的完整系统，而非浏览器 SDK。[README](https://github.com/lfnovo/open-notebook/blob/main/README.md)

**原生流程与布局（建议）**：多篇论文/网页/讲义 → 建笔记本与来源集 → 逐篇阅读、生成结构化摘录 → 将洞察保存成知识卡片 → 按问题组织材料 → 导出笔记与引用。左侧来源树，中间双页阅读区，右侧知识卡片和关联笔记；AI 操作依附于选中文段。首版不复制播客、所有模型设置和聊天历史等完整产品功能。

**真实接口与边界**：官方 API 参考明确所有应用端点位于 `/api`，包括 `/api/notebooks`、`/api/sources`、`/api/notes`、`/api/transformations/execute`、`/api/search` 和任务状态查询，运行时 `/openapi.json` 是权威 schema。来源处理可异步返回，再轮询 source status；无 worker 时任务会一直排队。[API 参考](https://github.com/lfnovo/open-notebook/blob/main/docs/7-DEVELOPMENT/api-reference.md)

**部署**：源码要求 Python **>=3.11,<3.13**。官方 Compose 包含 SurrealDB 与集 UI/API/worker 的 Open Notebook 服务；需要 LLM 与 embedding，播客另外依赖语音提供商。支持外部 API 或 Ollama；GPU 取决于本地模型选择。工作台保存自己的阅读布局与修订，上游继续持有 notebook/source 的权威记录，避免双主写入。[包声明](https://github.com/lfnovo/open-notebook/blob/main/pyproject.toml)、[Compose](https://github.com/lfnovo/open-notebook/blob/main/docker-compose.yml)、[配置说明](https://github.com/lfnovo/open-notebook/blob/main/README.md#quick-start)

**许可与账号边界**：应用为 **MIT**；Compose 使用 `surrealdb/surrealdb:v2` 浮动标签，数据库许可独立。已核对 SurrealDB v2.0.0 是 **BSL-1.1**，附加使用授权排除特定 Database Service；它不是 MIT，也不能用当前 main 的 3.x 许可替代实际 2.x 镜像的核验。正式部署须固定准确镜像与该版本条款。Open Notebook 当前 API 的可选保护是共享 Bearer 密码，不是多用户权限模型；适合个人/单团队资料台，不应直接宣称企业隔离已具备。[应用 LICENSE](https://github.com/lfnovo/open-notebook/blob/main/LICENSE)、[数据库 v2.0.0 LICENSE](https://github.com/surrealdb/surrealdb/blob/v2.0.0/LICENSE)、[共享密码说明](https://github.com/lfnovo/open-notebook/blob/main/docs/7-DEVELOPMENT/api-reference.md#authentication)

**判断**：P1，12–20 人日；如果用户已有 Open Notebook 可提升。先完成“导入两份材料→异步完成→摘录成笔记→引用回原文→保存重开”。没有后端只保存本地笔记，应叫资料笔记工作台，不应宣称 Open Notebook 功能已移植。

## 6. WrenAI：指标口径、SQL 与结果审查台

**官方仓库**：[Canner/WrenAI](https://github.com/Canner/WrenAI)。当前项目是以 MDL 语义层和可版本化业务上下文支撑 SQL 规划/执行的引擎，核心是 Rust/Apache DataFusion、Python SDK/CLI、连接器和 Agent 集成。2026-05-07 起 Wren Engine 并入本仓 `core/`；旧 Docker 聊天 BI 叫 **Wren GenBI Classic**，保留在 `legacy/v1` / `v1-final`，官方明确不再提供新功能或安全修复。不能把旧 UI 截图当作当前受维护主线的交付范围。[当前 README 与迁移说明](https://github.com/Canner/WrenAI/blob/main/README.md)

**原生流程与布局（建议）**：只读业务数据源＋指标口径 → 编辑/审阅 MDL、关系与示例查询 → 提问得到候选 SQL → 查看规划/校验结果 → 人工确认执行 → 保存查询与结果图。左侧是数据模型/指标树，中间 SQL 与结果表，右侧业务定义和校验信息；图表是结果视图，不用聊天气泡承载全部分析。

**真实接口与边界**：官方公开 `wrenai` CLI、`wren-langchain`、`wren-pydantic` 和 Python 集成方式；它们消费已编译的 MDL/上下文。浏览器包 `@wrenai/wren-core-wasm` 的确存在，但当前固定 CSP 不允许把 WASM 路线作为可直接嵌入方案。应在外部 Python 服务调用实际语义核心，Node 只转发结构化请求与结果。商业平台 API 的存在不等于开源引擎自带可直接复用的同款 REST 服务。[SDK 总览](https://github.com/Canner/WrenAI/blob/main/docs/core/sdk/overview.md)、[WASM 说明](https://github.com/Canner/WrenAI/blob/main/docs/core/sdk/wasm.md)

**部署**：Python **3.11+**、对应 Rust 核心发行物/连接器；工作台包不包含原生引擎。需要目标数据库的只读账号；若由外部 agent/Host 生成 SQL，还需模型和工具调用协议。核心语义查询本身不需要 GPU；自然语言生成和可选本地 embedding 的硬件需求取决于模型配置。[Python 包声明](https://github.com/Canner/WrenAI/blob/main/core/wren/pyproject.toml)、[架构](https://github.com/Canner/WrenAI/blob/main/docs/core/reference/architecture.md)

**许可与商业边界**：根许可证是路径映射：`core/**`、`sdk/**`、`skills/**`、`examples/**` 及其他根文件 **Apache-2.0**，`docs/**` **CC-BY-4.0**；AGPL-3.0 文本预先附带，但当前映射未把模块划入 AGPL，不能因仓库有该文件就标整个 WrenAI 为 AGPL。发行包的 manifest 在冲突时有其声明的优先规则；商标不在这些许可证授权内。当前 README 将行列权限/用户组、商业 GenBI UI、嵌入/API、审计等列为 Cloud/Enterprise Plus，不能把这些纳入免费的开源移植承诺。[完整许可映射](https://github.com/Canner/WrenAI/blob/main/LICENSE)、[商业功能边界](https://github.com/Canner/WrenAI/blob/main/README.md#open-core-whats-oss-whats-commercial)

**判断**：有明确 BI 用户与现成服务时 P1，否则 P2；18–30 人日。先用官方样例或小型只读库验“同一指标口径→语义校验→SQL→真实结果”。不复活已停止安全维护的 Classic，也不将 WASM 示例换皮后宣称符合模板。

## 7. RAGFlow：文档入库、切片与召回复核台

**官方仓库**：[infiniflow/ragflow](https://github.com/infiniflow/ragflow)。核心是文档理解、切片、知识入库、检索与 agent 工作流；适合把文档切片质量和召回质量做成可检查流程。[README](https://github.com/infiniflow/ragflow/blob/main/README.md)

**原生流程与布局（建议）**：扫描件/制度文件/技术资料 → 选择解析配置 → 批量解析 → 查看切片与原页 → 提交测试问题 → 查看召回片段 → 记录问题与重新处理。主区是原文/切片双栏，左侧是数据集与解析队列，底部是测试问题和召回表。工作台可以做入库质检产品，不必复制上游完整 agent builder。

**真实接口与边界**：当前 HTTP 文档提供 `/api/v1/datasets`、数据集下文档/切片管理、解析与 retrieval；另有官方 Python SDK。需要逐一按所选服务版本绑定请求。当前文档专门列出 **1.0 Go 后端迁移**，例如若干更新接口由 PUT 改为 PATCH，旧适配器不能假设无缝继续工作。[HTTP API 与迁移表](https://github.com/infiniflow/ragflow/blob/main/docs/references/http_api_reference.md)、[Python API](https://github.com/infiniflow/ragflow/blob/main/docs/references/python_api_reference.md)

**部署的时效变化**：当前主线 README 已写 Go 服务、CGO/native libraries 与 DeepDoc 模型资源，不能继续概括为“一个 Python 服务”。Docker 推荐起点是 **4 CPU、16 GB RAM、50 GB 磁盘**，实际依赖规模和模型；依赖包括数据库、文档引擎、对象存储与消息/缓存服务。源码构建还要求特定 Go/Clang/CMake。当前说明提示 macOS 不受支持，应优先视作外部 Linux 服务，不承诺在这台 Mac 本地直接部署。[部署要求](https://github.com/infiniflow/ragflow/blob/main/README.md#-docker-deployment)、[当前 Compose 依赖](https://github.com/infiniflow/ragflow/blob/main/docker/docker-compose-base.yml)

**许可**：根源码 **Apache-2.0**。下载的 DeepDoc/OCR/embedding 权重、文档引擎及镜像内第三方组件必须按具体版本和来源另核；本次未完成整镜像或所有模型的许可审计，也未把企业功能当作开源交付内容。[LICENSE](https://github.com/infiniflow/ragflow/blob/main/LICENSE)、[运行资源说明](https://github.com/infiniflow/ragflow/blob/main/README.md)

**判断**：P2，15–25 人日；已有 RAGFlow 的组织可提升 P1。选择它应因为用户需要真实解析与召回维护，而非其知名度。先验证同一服务版本的上传、解析状态、原页切片定位和 retrieval，服务端资源准备另算。

## 8. Onyx：企业检索证据与连接器巡检台

**官方仓库**：[onyx-dot-app/onyx](https://github.com/onyx-dot-app/onyx)。Onyx 将连接器同步来的文档、元数据与权限建立索引，提供搜索、RAG、agent 与研究能力。**Standard** 有知识索引与同步 worker；**Lite 不具备文档索引能力**，不能因为 Lite 占用低就拿它实现企业知识检索。[README 的部署模式](https://github.com/onyx-dot-app/onyx/blob/main/README.md#-deployment-modes)

**原生流程与布局（建议）**：连接已有企业 Onyx → 选择资料集/来源 → 查询 → 按来源和时间筛选 → 打开证据 → 收藏成研究包；附加连接器最近同步状态及失败条目。主区是结果列表与原文预览，左侧是资料集和筛选，右侧是证据篮。价值在既有索引、权限和来源链，不在再画一个对话界面。

**真实接口与边界**：官方 REST 文档支持 Bearer token，并区分 service account API key 与个人 PAT；源码已有 `POST /api/search`。MCP 服务另提供 `search_indexed_documents` 及资料集资源。应采用代表当前用户且权限合适的凭据；不能用一个管理员 key 给所有 Floatboat 使用者查询再把结果当作有用户权限控制。当前文档说明自定义组/可配置组权限为 EE 特性。[认证文档](https://docs.onyx.app/developers/overview)、[搜索 API 源码](https://github.com/onyx-dot-app/onyx/blob/main/backend/onyx/server/features/search/api.py)、[MCP 服务](https://github.com/onyx-dot-app/onyx/blob/main/backend/onyx/mcp_server/README.md)

**部署**：完整外部服务，典型有 Python API/worker、模型服务、PostgreSQL、搜索索引、缓存和对象存储。当前 Compose 已使用 **OpenSearch**，不要按旧资料把固定依赖写成 Vespa。可用托管模型或本地模型；还需要 GitHub/知识库/企业文档系统等实际连接账号。GPU 需求依赖索引/推理模型选择，不能由工作台替代。[当前 Compose](https://github.com/onyx-dot-app/onyx/blob/main/deployment/docker_compose/docker-compose.yml)

**许可**：非 `ee` 部分以 **MIT Expat** 为主，第三方组件保留原许可；`backend/ee`、`web/src/app/ee`、`web/src/ee` 是 **Onyx Enterprise License**。EE 生产使用要求适用商业协议和正确席位数的有效许可证，开发测试例外并不授予自由再分发权。工作台应接用户已有合规服务，不复制 EE 源码到 MIT 工作台；是否经 API 使用某企业能力仍取决于服务授权。[根 LICENSE](https://github.com/onyx-dot-app/onyx/blob/main/LICENSE)、[EE LICENSE](https://github.com/onyx-dot-app/onyx/blob/main/backend/ee/LICENSE)

**判断**：P2，15–25 人日；已有 Onyx 与实际权限模型时可提升 P1。至少使用两个不同权限的真实测试身份验证结果隔离与资料集范围，之后才能声称企业检索集成成立。

## 9. Khoj：私人文档语义检索与证据收藏台

**官方仓库**：[khoj-ai/khoj](https://github.com/khoj-ai/khoj)。支持从 PDF、Markdown、Org-mode、Word、Notion 等材料搜索/回答，并提供在线搜索、agents 和研究自动化。当前 README 同时推广另一个产品 Pipali；这说明作者产品方向在扩展，**不能据此认定 Khoj 已归档或停止维护**。[README](https://github.com/khoj-ai/khoj/blob/master/README.md)

**原生流程与布局（建议）**：个人知识文件夹/同步来源 → 语义检索 → 对照命中段落 → 按主题收藏证据 → 整理为可导出的研究卡片。主区是搜索结果与原文预览，侧边是文件类型/来源/主题筛选，底部是收藏集合。首版专注已有资料检索；自动调度、语音、通用 agent 与 Host 重叠较大，不应成为初始移植范围。

**真实接口与边界**：官方服务源码有 `/search`、内容导入路由和 chat 路由，均由 Khoj 应用挂载；可以通过其实际服务集成。这里依据的是源码接口，尚未证明它们具有独立稳定 SDK 的兼容承诺；实现前必须按固定版本读取运行时 schema 并验证鉴权与上传格式。[搜索 API](https://github.com/khoj-ai/khoj/blob/master/src/khoj/routers/api.py)、[内容路由](https://github.com/khoj-ai/khoj/blob/master/src/khoj/routers/api_content.py)、[路由挂载](https://github.com/khoj-ai/khoj/blob/master/src/khoj/main.py)

**部署与许可**：外部 Python 服务，官方 Compose 包括 PostgreSQL/pgvector 和 Khoj，还配置了 SearXNG、代码沙箱与 computer 等辅助服务；并非全部都需要用于首版纯检索流程。远程 LLM 要账号，Ollama 等本地模型要相应硬件；是否启用搜索、浏览器和执行工具应按实际场景裁剪。核心为 **GNU AGPLv3**，修改版的网络交互源代码义务与分发条件需要保留，不能改标 MIT；API 分离也不自动免除对被修改 Khoj 服务的义务。模型权重独立核验。[Compose](https://github.com/khoj-ai/khoj/blob/master/docker-compose.yml)、[LICENSE](https://github.com/khoj-ai/khoj/blob/master/LICENSE)

**判断**：P2，12–20 人日。适合已经使用 Khoj、希望在工作台集中复核来源的人；若从零搭建，其差异化低于前三项。公开元数据显示最近 push 是 2026-08-02，较本组其他项目久，但 `archived=false`；应先确认版本与维护计划，而不是直接判定项目死亡。[官方 GitHub 元数据](https://api.github.com/repos/khoj-ai/khoj)

## 实际维护信号快照

以下值由 **2026-10-27 直接读取 GitHub repository API** 得到；时间为 UTC。`pushed_at` 是仓库最近 push，不保证属于默认分支，也不等于最近正式发行；stars 表示关注度，不表示可靠性。所有候选当时 `archived=false`。本轮没有用未经读取的 release 日期补足“活跃”判断。

| 项目 | Stars | pushed_at（UTC） | 核验来源 |
| --- | ---: | --- | --- |
| Docling | 69,680 | 2026-10-27 17:11:50 | [API](https://api.github.com/repos/docling-project/docling) |
| LangExtract | 39,055 | 2026-10-17 07:27:52 | [API](https://api.github.com/repos/google/langextract) |
| LightRAG | 40,370 | 2026-10-22 18:04:29 | [API](https://api.github.com/repos/HKUDS/LightRAG) |
| GPT Researcher | 30,314 | 2026-10-10 22:03:53 | [API](https://api.github.com/repos/assafelovic/gpt-researcher) |
| Open Notebook | 40,635 | 2026-10-25 21:45:58 | [API](https://api.github.com/repos/lfnovo/open-notebook) |
| WrenAI | 17,988 | 2026-10-27 06:26:38 | [API](https://api.github.com/repos/Canner/WrenAI) |
| RAGFlow | 92,965 | 2026-10-27 13:19:15 | [API](https://api.github.com/repos/infiniflow/ragflow) |
| Onyx | 33,026 | 2026-10-27 17:35:48 | [API](https://api.github.com/repos/onyx-dot-app/onyx) |
| Khoj | 37,850 | 2026-08-02 01:55:40 | [API](https://api.github.com/repos/khoj-ai/khoj) |

WrenAI 的维护风险是**旧产品线停止维护**，并非整个仓库归档；Khoj 的信号是最近 push 较久并出现新产品入口，不能扩大成停止维护的结论。RAGFlow 与 Onyx 当前主线都有与历史文章不同的技术栈细节，应在真正立项时固定 release/commit 与对应文档。

## 最先做的三个边界

1. **LangExtract 抽取复核**：工作台自建字段/示例编辑、原文高亮、记录表与修订保存；外部 Python 核心执行真实 `lx.extract()`。先接文本，输出真实区间与 JSONL，再接 Docling 文本。需要证据区间和失败状态，不交付通用聊天外壳。
2. **Docling 文档校对**：工作台自建原页、结构树、表格修订和导出；官方 docling-serve 负责转换。首版只需要上传、任务轮询、结果获取，不必部署向量库或 agent 平台。
3. **LightRAG 图谱检查**：工作台自建图谱检查、证据面板、检索测试集和问题记录；真实 LightRAG 服务负责索引、图关系和召回。先只读图与查询，避免一次引入图修改、存储迁移和完整聊天产品。

三项可以共享附件、任务记录和来源引用规范，但应保留各自的原生操作空间。只有真实调用上游、展示实际中间结果并通过保存/恢复/失败验收后，才更新目录中的实现状态。本轮仅完成候选研究，不构成任何一项已运行、已迁移或已接通 Host 的证明。
