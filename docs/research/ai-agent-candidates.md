# AI / Agent 工作台候选研究

核查日期：2026-10-27。范围：10 个 GitHub 项目，其中 9 个保留为不同层级的候选，Flowise 因官方停止维护仅保留迁移用途。本次只有官方仓库、许可证、依赖声明及 API 文档研究；**未安装候选、未构建或运行集成、未调用模型、未连接真实 Host，不能当成兼容性验收。** 下文产品布局、SQLite 数据模型和连接器均是建议新增的工作，不是上游自动提供的现成功能。

## 选型结论与模板边界

建议先做 **LangGraph.js 人工复核流程台、Promptfoo 回归评测台、Langfuse 调用复盘台**。三者分别解决执行状态、质量比较、生产问题定位，能形成闭环；其中只有 LangGraph 核心适合作为第一批直接装入 Node 端的库进行验证。Promptfoo 默认依赖路径含本地 libSQL，先走外部执行器或导入真实评测结果；Langfuse 先接已有服务，不在工作台里部署整套平台。

- 固定模板为 Node 22、React 19.2.3、SQLite。根项目要求 `>=22.16.0 <23`，已有批次实际使用 22.22.2。声明“支持 Node 22”仍需比较最低补丁版本；Promptfoo 当前最低 22.22.0，不能据此假设所有符合模板下限的环境均满足它。[根配置](../../package.json)、[批次环境](../batch-02-11.md)。
- 浏览器 CSP 为 `script-src 'self'`、`connect-src 'self'`，无 `unsafe-eval` 或 `wasm-unsafe-eval`；现有真实 Chrome 记录已显示浏览器 WASM 被阻止。外部模型、SDK 网络调用和服务 API 必须经工作台同源 Node 路由，CDN 脚本、远程 iframe、浏览器直连服务不是默认接法。[现有 CSP 证据](template-csp-probe.json)。
- 不把 Python、Docker、Chromium、原生 SQLite 扩展、Next.js 服务器塞入工作台包。库放 Node 端、React 自建任务界面；外部服务独立运行。Node 侧 WASM 与浏览器 CSP 不是同一约束，但固定打包器是否保留其资产仍需实测。
- 任务给定的 Host 能力包括 LLM、Agent、ASR，当前 `localHost` 未连接。它们是未来适配目标，不是已验证接口：不能声称现有 Host 自动兼容 LangChain 模型协议、OpenAI REST 或 Python SDK。可先导入真实结果，或在有明确配置的外部服务上运行；缺服务时显示未连接，不产出假结果。
- SQLite 保存输入快照、版本、运行 ID、检查点、复核决定、评分与失败原因；较大的原文、trace、屏幕截图与 patch 保存为附件并持久化引用。编辑、未完成输入、失败状态均遵守[自动保存契约](../../scripts/blueprints/AUTOSAVE.md)。

“P1”表示优先验证最小接入；“P2”表示依赖外部服务或业务需求后再做；“暂缓”表示工程、许可或维护成本明显偏高。工作量是相对工程量，不是交付承诺。

| 候选 | 独立产品任务与布局 | 建议接法 | 工作量 / 优先级 | 主要边界 |
|---|---|---|---|---|
| [LangGraph.js](https://github.com/langchain-ai/langgraphjs) | 人工复核与恢复：流程图 + 待复核卡 + 检查点时间线 | Node 核心库 + 自建 SQLite checkpointer | 中 / **P1** | 官方 SQLite adapter 用 `better-sqlite3`，不能照搬 |
| [Promptfoo](https://github.com/promptfoo/promptfoo) | 提示词回归：用例 × 版本矩阵 + 失败差异 | 真实结果导入；外部评测 runner 的同源连接器 | 中 / **P1** | Node ≥22.22.0；默认 libSQL 路径；可选 native 能力 |
| [Langfuse](https://github.com/langfuse/langfuse) | 调用复盘：运行列表 + span 瀑布图 + 成本/反馈面板 | JS client 或 REST 接已有 Langfuse | 中 / **P1** | 服务端是独立多服务系统；核心 MIT、EE 商业许可 |
| [Mastra](https://github.com/mastra-ai/mastra) | 批量内容加工：批次表 + typed steps + 人工回填 | 仅 `@mastra/core` 的 Node 工作流；自建存储适配 | 中–高 / P2 | Apache-2.0 核心、任意 `ee/` 目录商业许可；含 WASM 依赖 |
| [Langflow](https://github.com/langflow-ai/langflow) | 结构化抽取：原文 + schema 编辑 + 字段复核表 | API 调用已部署抽取 flow | 中 / P2 | Python 服务；JSON 符合 schema 不代表字段事实正确 |
| [Dify](https://github.com/langgenius/dify) | 知识库运营：文档/索引队列 + 检索证据 + 工作流任务 | 接用户已有单 workspace 的 API | 中–高 / P2 | 定制 Apache 条款；多租户和使用其前端另有限制 |
| [Ragas](https://github.com/vibrantlabsai/ragas) | RAG 质量审阅：问题、答案、检索证据三栏 + 指标 | Python evaluator 服务或真实结果导入 | 中 / P2 | judge/embedding 按指标另配；维护新鲜度需复核 |
| [browser-use](https://github.com/browser-use/browser-use) | 网页采集复核：任务队列 + 步骤截图 + 结构化行 | 外部 Python Agent/浏览器服务或 Cloud API | 高 / P2 | 浏览器与模型独立运行；不是工作台内的 DOM 自动化 |
| [OpenHands](https://github.com/OpenHands/OpenHands) | 工程任务审阅：任务 + 执行轨迹 + diff/测试结果 | 外部 OpenHands 服务；首版只接收任务与产物 | 高 / 暂缓 | 当前 Agent Canvas 要 Node ≥24 与外部 agent 后端 |
| [Flowise](https://github.com/FlowiseAI/Flowise) | 既有流程迁移：flow 清单 + 节点/变量检查 + 旧新结果比较 | 仅已有实例 API/JSON 迁移 | 高 / **新建不选** | 官方 EOL、仓库已归档；Node ^24、原生 sqlite3、EE 许可 |

## 1. LangGraph.js：人工复核与恢复流程台

**原生任务。** 提交资料 → 提取/校验 → 在缺项或高风险步骤停下 → 人工修改后恢复 → 输出最终结构化记录。中央画布显示执行过的节点和分支，右侧显示当前待复核字段，底部查看历史检查点。第一版用固定的少量流程模板；任意代码编辑器、任意工具市场和完整 Agent IDE 不在边界内。

**已核实接口。** `@langchain/langgraph` 提供 `StateGraph`、节点/边的编排、`compile({ checkpointer })`、`invoke`/stream；`interrupt(payload)` 将待处理数据返回给调用方，`new Command({ resume: ... })` 配合原 `thread_id` 恢复。恢复时中断所在节点会从头执行，所以中断前的写操作必须幂等，不能把“暂停恢复”理解成运行栈原地继续。[中断与恢复](https://docs.langchain.com/oss/javascript/langgraph/interrupts)、[持久化](https://docs.langchain.com/oss/javascript/langgraph/persistence)。

**模板适配。** 核心包声明 Node ≥18，当前清单为 1.5.3，不要求 React，适合由 Node 22 执行，React 19 自建图和复核表。当前 `@langchain/langgraph-checkpoint-sqlite` 依赖 `better-sqlite3`，不符合纯 JS 依赖边界；需按 checkpointer 契约接模板已支持的 SQLite，完整保存 checkpoint、metadata、pending writes 和版本，不用 `MemorySaver` 冒充重启持久化。首版无 Python、Docker 或独立图数据库需求；LLM 节点仍须连接真实模型或经验证的 Host adapter。[核心包](https://github.com/langchain-ai/langgraphjs/blob/main/libs/langgraph-core/package.json)、[SQLite adapter](https://github.com/langchain-ai/langgraphjs/blob/main/libs/checkpoint-sqlite/package.json)。

**许可。** 仓库 MIT，可商业使用和分发，保留版权与许可声明。此结论只覆盖所选开源库，不包含 LangSmith 托管产品的服务权利。[LICENSE](https://github.com/langchain-ai/langgraphjs/blob/main/LICENSE)。

## 2. Promptfoo：提示词与 Agent 回归评测台

**原生任务。** 导入测试集 → 选择提示词/模型版本 → 执行一批评测 → 按失败类型筛选 → 对比基线 → 导出接受/拒绝结论。主视图是用例 × 版本的矩阵，选中单元格查看实际输入、输出、断言、耗时和错误；版本栏记录运行配置及不可重放项。这比再包一个聊天窗口更接近上游价值。

**已核实接口。** Node 包 `evaluate(testSuite, options)` 返回 Eval record，再调用 `toEvaluateSummary()` 取得结果；支持自定义 provider function，可把未来经过验证的 Host LLM 调用接成 provider。程序化 transform 可以传函数，但函数不能自动序列化进已存配置，回放必须记录稳定的变换标识与版本。[Node API](https://www.promptfoo.dev/docs/usage/node-api-reference/)、[Node 包用法](https://www.promptfoo.dev/docs/usage/node-package/)。

**模板适配。** 当前源码包 0.125.1，`engines` 为 Node ≥22.22.0，直接依赖 `@libsql/client`，可选依赖包括 `sharp`，部分 provider 还依赖 Python、浏览器或额外 SDK。libSQL client 的默认 Node 入口及 `libsql` 依赖使其不能直接标为“纯 JS 可嵌入”。第一版导入真实 Promptfoo JSON 结果并保留原始附件，或调用我们另写的外部 runner；runner 不是本次发现的现成官方通用任务 API。后续若验证直接库接入，只开放固定 provider、JSON/string 断言和已注册变换，不执行用户上传的任意 JS/Python。React 19 和 SQLite 只承担用例、版本与报告，模型评测在真实 runner 上完成。[包清单](https://github.com/promptfoo/promptfoo/blob/main/package.json)、[libSQL 入口与依赖](https://github.com/tursodatabase/libsql-client-ts/blob/main/packages/libsql-client/package.json)。

**许可。** 仓库 MIT，可商用、修改和分发，保留版权及许可；外部模型、托管能力的服务条款和费用独立。第一版确定性断言可不使用 judge 模型，但运行被测 AI 系统仍需真实模型；LLM rubric 等指标另需 judge。[LICENSE](https://github.com/promptfoo/promptfoo/blob/main/LICENSE)、[评测入门](https://www.promptfoo.dev/docs/getting-started/)。

## 3. Langfuse：调用轨迹、成本与反馈复盘台

**原生任务。** 按错误/延迟/成本选择运行 → 查看父子 span、工具入参与输出 → 标注失败原因 → 关联提示词版本与用例 → 导出问题包。布局是左侧运行队列、中央时间瀑布、右侧属性及评分，不把整个 Langfuse 后台嵌进 iframe。SQLite 只存筛选、审阅意见和必要快照；远端仍是原始 trace 来源。

**已核实接口。** `@langfuse/client` 的 `LangfuseClient` 提供 `api.observations`、`api.metrics`、`api.scores` 和 `prompt.get`；JS/TS SDK v6 删除 legacy namespace，score 读取为 `api.scores.getMany`，不能照抄旧版 `trace()/generation()` 示例。服务实例 v4.36+ 可从 `/api/openapi.yaml` 获得实际契约。首版只读取 observations 与 metrics、写入明确的人工 score，不复制组织管理接口。[Public API 与版本说明](https://langfuse.com/docs/api-and-data-platform/features/public-api)、[score API](https://langfuse.com/docs/evaluation/evaluation-methods/scores-via-sdk)。

**模板适配。** 当前 JS client 清单 6.0.2、Node ≥22，能优先作为 Node 同源连接器候选；也可使用标准 HTTP，React 19 自建可视化。整个平台当前 web 包要求 Node 24，Docker Compose 包含 web、worker、PostgreSQL、ClickHouse、Redis、MinIO，不能用模板 SQLite 替换后声称已经完成移植。浏览器只访问同源路由。只读已有 traces 不需要模型；在线 judge 或新 Agent 运行才有模型需求。[JS 包](https://github.com/langfuse/langfuse-js/blob/main/packages/client/package.json)、[web 包](https://github.com/langfuse/langfuse/blob/main/web/package.json)、[服务拓扑](https://github.com/langfuse/langfuse/blob/main/docker-compose.yml)。

**许可。** 主仓库通常部分为 MIT Expat，但根许可证明确排除 `ee/`、`web/src/ee/`、`worker/src/ee/`、`packages/shared/src/server/ee/`；这些部分受 Enterprise License 约束，开发测试以外的使用及分发不能按 MIT 处理。JS SDK 独立仓库是 MIT。我们自建客户端、调用获授权实例，不复制 EE UI/管理实现。[主许可](https://github.com/langfuse/langfuse/blob/main/LICENSE)、[EE 许可](https://github.com/langfuse/langfuse/blob/main/ee/LICENSE)、[SDK 许可](https://github.com/langfuse/langfuse-js/blob/main/LICENSE)。

## 4. Mastra：批量内容加工与人工回填台

**原生任务。** 一批商品说明、会议摘录或资料 → 提取字段 → 分类 → 生成稿件 → 人工回填缺项 → 下载成品。布局以批次数据表为中心，展开某行查看 typed steps、输入/输出和暂停原因，适合生产一批结构化成果。与 LangGraph 二选一作为首个运行引擎即可，不应同时引入两个状态系统。

**已核实接口。** `createWorkflow`、`createStep`、`.then()`、`.commit()` 定义有 schema 的流程；`workflow.createRun()`、`run.start({ inputData })` 启动；step 的 `suspend()` 与 `run.resume({ step, resumeData })` 提供人工回填。可持久恢复的 snapshots 要配置真实 storage provider，不能只保存一份 UI 状态就声称运行可恢复。[工作流](https://mastra.ai/docs/workflows/overview)、[暂停恢复](https://mastra.ai/docs/workflows/suspend-and-resume)。

**模板适配。** 当前 `@mastra/core` 源码版本是 1.80.0-alpha.4、Node ≥22.13.0；这是 main 分支清单，不应直接作为稳定发布锁定版本。核心在 Node 端运行，包含 `xxhash-wasm`，须验证固定构建器保留 Node WASM 资源，不能放浏览器。`@mastra/libsql` 默认依赖 `@libsql/client`，同样需避开本地 native 路径，验证模板 SQLite 存储适配或外部存储。不用 Mastra Studio 替代模板前端；无 Python 必需项，模型提供方/Host adapter 仍需配置。[core 清单](https://github.com/mastra-ai/mastra/blob/main/packages/core/package.json)、[libsql store](https://github.com/mastra-ai/mastra/blob/main/stores/libsql/package.json)。

**许可。** 当前根许可是 **Apache-2.0 核心 + 所有名为 `ee/` 的目录采用商业许可**，明确例举 core auth、agent-builder、editor 的 EE。EE License v2（2026-09-22 生效）是 source-available，开发测试不等于生产授权；生产使用要求书面协议和有效 License Key，且不授予通用再分发权。首版只选非 EE 的核心工作流，保留 Apache 许可、声明及修改说明；不能套用历史“Mastra 全 MIT”的介绍。[根许可](https://github.com/mastra-ai/mastra/blob/main/LICENSE.md)、[EE 许可](https://github.com/mastra-ai/mastra/blob/main/ee/LICENSE)。

## 5. Langflow：文档字段抽取与复核台

**原生任务。** 上传/粘贴原文 → 定义字段 schema → 批量抽取 → 对照原文修改缺失/错误值 → 导出 JSON/CSV。采用原文、字段定义、抽取结果三栏布局；流程图是可展开的配置视图，字段复核是主任务。首版仅文本与已支持的文档解析路径，不承诺 OCR 或任意附件都能识别。

**已核实接口。** Structured Output 组件使用 `input_value`、`system_prompt`、`output_schema` 和语言模型生成 JSON 或 Table。已部署 flow 可经 `POST /api/v1/run/{flow_id_or_name}` 调用；`/api/v1/flows` 支持 flow 创建，API 使用 `x-api-key`。v2 Workflow API 官方仍标 Beta，第一版优先锁定 v1 和具体实例 OpenAPI。schema 合法性不是事实准确度，引用定位、人工确认和字段变更记录须由工作台补充。[Structured Output](https://docs.langflow.org/structured-output)、[API 用法](https://docs.langflow.org/api-reference-api-examples)、[v2 状态](https://docs.langflow.org/workflow-api)。

**模板适配。** 主服务当前 Python `>=3.10,<3.15`，有 ONNX、模型/文件处理集成等依赖，适合作为外部 Python/Docker 服务。前端清单使用 React 19、Node ≥20.19，说明版本有交集，但不证明整套 IDE 的 bundle、worker 和动态组件在固定模板可用。工作台 Node 22 仅调用指定 flow，SQLite 保存 schema 版本、输入、原始响应与人工修订；外部模型或本地推理服务必需，不能因有可视化节点就消除模型依赖。[Python 清单](https://github.com/langflow-ai/langflow/blob/main/pyproject.toml)、[前端清单](https://github.com/langflow-ai/langflow/blob/main/src/frontend/package.json)。

**许可。** 已读主仓库 LICENSE 为 MIT；当前完整 main 文件树中仅发现该 LICENSE，未发现 `ee/` 或 `enterprise/` 路径中的另行许可证。这个结论覆盖所查主仓库，不代表第三方组件、模型及托管服务继承 MIT；不要把 Dify/Flowise 的商用限制套给 Langflow，也不要把服务权益算进 MIT。[LICENSE](https://github.com/langflow-ai/langflow/blob/main/LICENSE)、[文件树证据](https://api.github.com/repos/langflow-ai/langflow/git/trees/main?recursive=1)。

## 6. Dify：知识库索引与工作流运营台

**原生任务。** 批量文档 → 查看解析/分块/索引进度 → 检索测试并检查命中文段 → 在指定发布版本执行加工流程 → 复核产出。主界面是文档队列与检索证据，附带运行详情和 Human Input 表单；避免重新造 Dify 的全部应用市场和组织后台。

**已核实接口。** Knowledge API 支持按文本/文件建文档，返回 batch 后轮询 indexing status，支持检索测试、chunk 与 metadata 管理。Workflow API 可运行当前或指定发布版本，区分控制运行的 `task_id` 和持久记录的 `workflow_run_id`，可停止、重连事件流及处理 Human Input。应使用实例对应的 App/Knowledge API，而非抓取控制台内部路由。[Knowledge API](https://docs.dify.ai/en/api-reference/guides/knowledge)、[Workflow API](https://docs.dify.ai/en/api-reference/guides/workflow)。

**模板适配。** 当前 API 清单要求 Python `~=3.13.0`；Compose 有 API/worker、数据库、Redis、sandbox、plugin daemon 等，向量存储按配置选择，并非所有列出的镜像同时必需。它是独立平台，不能移入 Node 22/SQLite。工作台通过同源 REST 接用户已有实例；React 19 自建文档运营界面，SQLite 保存本地项目与远端 ID 映射。索引依模型配置需要 embedding，生成/抽取需要 LLM；插件或模型的独立许可证继续适用。[Python 清单](https://github.com/langgenius/dify/blob/main/api/pyproject.toml)、[Compose](https://github.com/langgenius/dify/blob/main/docker/docker-compose.yaml)、[API 认证](https://docs.dify.ai/en/api-reference/guides/get-started)。

**许可。** Dify Open Source License 是附加条件的 Apache-2.0，**不是标准 Apache-2.0，也不能当无条件可商用再托管**。允许商业后端使用，但未获书面授权不得用源码运营多租户环境，tenant 定义为 workspace；使用其前端时不能去除或修改 logo/版权信息，前端定义含 `web/` 或 web Docker image。自建纯 API 客户端不使用其前端，不能由此推导多 workspace 托管也被允许。优先接用户已有单 workspace；平台代运营、多租户或复制前端需先按真实部署形态解决商业授权。[完整许可](https://github.com/langgenius/dify/blob/main/LICENSE)。

## 7. Ragas：RAG 检索与答案质量审阅台

**原生任务。** 导入问题、答案、检索段落、参考答案 → 选择指标与 judge → 批量评分 → 按低分/分歧复核 → 比较检索策略版本。中心三栏并排显示问题、回答、证据，底部才是指标趋势；评分理由与人工反例要能回写为下一批测试数据。

**已核实接口。** 当前官方新项目推荐 `ragas.metrics.collections.Faithfulness`，经 `llm_factory` 配模型，再 `scorer.ascore(user_input=..., response=..., retrieved_contexts=...)` 取得 `result.value`；老的 `SingleTurnSample`/`single_turn_ascore` 示例标为 legacy。Faithfulness 衡量回答与给定检索上下文的一致性，并非对现实真假的最终证明。其他检索质量指标及 testset generation 要逐项锁定版本和所需字段。[现行 Faithfulness API](https://docs.ragas.io/en/latest/concepts/metrics/available_metrics/faithfulness/)、[仓库能力](https://github.com/vibrantlabsai/ragas/blob/main/README.md)。

**模板适配。** Python ≥3.9，依赖 NumPy、LangChain 等；在外部 Python 评测服务执行，Node 同源连接或导入该服务的真实结果，React/SQLite 保存数据集版本、judge 配置、分数、解释和人工判断。无官方通用 REST 服务可直接从库安装中推导；服务封装、异步 job、取消/失败处理由我们实现。LLM-based 指标需要 judge，部分相关性指标另需 embedding；使用本地 classifier 又增加模型权重和推理依赖，不能把所有指标标为无成本离线。[pyproject](https://github.com/vibrantlabsai/ragas/blob/main/pyproject.toml)。

**许可与维护。** Apache-2.0，可商用，遵守许可证/NOTICE/修改声明要求。GitHub 此次返回未归档，但最近 push 为 2026-02-24，明显早于本组多数项目；只记录这一事实，不断言已停更。开始实现前复核发布版本、文档与仓库 API 是否一致。[LICENSE](https://github.com/vibrantlabsai/ragas/blob/main/LICENSE)、[仓库元数据](https://api.github.com/repos/vibrantlabsai/ragas)。

## 8. browser-use：网页操作取证与结构化采集台

**原生任务。** 给定已授权的网站与字段清单 → 执行受限采集任务 → 查看逐步截图/URL/动作 → 核对抽取行 → 下载数据和证据。布局为任务队列、当前步骤截图、结构化结果表。首版限定读取/采集，不自动提交交易或对外发布；这是具体产品范围，不是宣称上游只能读取。

**已核实接口。** Python `Agent(task=..., llm=..., browser=..., output_model_schema=...)`、`await agent.run()` 与 history 结果；`output_model_schema` 接 Pydantic schema，`tools` 可注册操作，参数提供步骤/模型超时、失败上限和对话存储路径。README 区分本地 Python 库、远程浏览器和全托管 Agent API，三者不能混称同一种部署。[README](https://github.com/browser-use/browser-use/blob/main/README.md)、[Agent 参数](https://docs.browser-use.com/open-source/customize/agent/all-parameters)。

**模板适配。** 当前库 Python ≥3.11、<4，CDP 浏览器环境和模型独立运行；不在工作台包安装 Chromium/Python。Node 同源连接外部任务服务，React 19 展示服务提供的截图和结构化结果，SQLite 保存任务与审阅状态。即使上游另有 JS harness，也不能推导 Python Agent 整体变成纯 JS。Host Agent 不能未经适配自动充当 browser-use 的 `llm`；模型视觉/工具支持须逐项验证。[pyproject](https://github.com/browser-use/browser-use/blob/main/pyproject.toml)。

**许可。** 本库 MIT，可商用并保留版权/许可；Browser Use Cloud、浏览器托管及模型推理另受服务条款与计费限制。开源许可不包含云运行额度，也不保证每个网站都能自动完成任务。[LICENSE](https://github.com/browser-use/browser-use/blob/main/LICENSE)、[部署形态说明](https://github.com/browser-use/browser-use)。

## 9. OpenHands：工程任务结果与代码变更审阅台

**原生任务。** 从明确的工程任务开始 → 外部 agent 在受限工作区执行 → 汇总变更、测试和失败 → 用户审阅 diff → 输出 patch 或进入既有 PR 流程。布局以任务、执行轨迹、文件 diff 和测试结果为核心。Floatboat 已有 Agent，首版应补工程结果审阅能力，不再完整复制另一套 agent 会话产品。

**已核实接口。** 当前官方主仓库已经是 Agent Canvas，可连接本地、Docker、VM 或其他 agent 后端，并可使用 ACP agents。Cloud API 使用 `POST /api/v1/app-conversations`，输入是 `initial_message.content`、`selected_repository`；响应先给启动任务，直到 READY 后才有 `app_conversation_id`。旧 `/api/conversations` 已在文档标为弃用并计划 2026-04-01 移除，不能拿旧 quickstart 做当前集成契约。[当前 README](https://github.com/OpenHands/OpenHands/blob/main/README.md)、[官方 Cloud API](https://github.com/OpenHands/docs/blob/main/openhands/usage/cloud/cloud-api.mdx)。

**模板适配。** 当前 Canvas 包 1.34.0 要 Node ≥24，依赖 React 19.3 和独立 agent 后端；默认本机路径需要 `uv`，Docker 是另一个部署选项，不是每种模式都硬性要求 Docker。不能直接装进 Node 22 固定模板。应先调用独立实例经核实的 REST/SDK、取得任务/状态/产物，React 19.2.3 自建 diff 审阅，SQLite 保存任务与审阅记录。模型、代码工具链和执行工作区都属于外部 agent runtime；云账户的仓库访问和服务授权独立配置。[当前包清单](https://github.com/OpenHands/OpenHands/blob/main/package.json)、[自托管说明](https://github.com/OpenHands/OpenHands/blob/main/docs/SELF_HOSTING.md)。

**许可。** 此次当前主仓库根 LICENSE 是 MIT，完整 main 文件树只发现该 LICENSE；未把旧版本或另一个企业仓库的条款套到当前仓库。OpenHands Cloud、Enterprise 基础设施和第三方 ACP agents 的使用权益仍需分别核对，不能从 Canvas MIT 推出。[LICENSE](https://github.com/OpenHands/OpenHands/blob/main/LICENSE)、[文件树](https://api.github.com/repos/OpenHands/OpenHands/git/trees/main?recursive=1)。

## 10. Flowise：只保留既有流程迁移用途

**为什么不进入新建清单。** 官方 sunset 公告列出 2026-07-29 停止功能开发、2026-08-10 归档、2026-08-31 EOL；本次 GitHub API 实际返回 `archived: true`，README 也明确已归档。新做通用 Flowise Agent builder 意味着我们主动接过维护责任，优先级应低于仍维护的替代方案。[官方公告](https://flowiseai.com/sunset)、[README](https://github.com/FlowiseAI/Flowise/blob/main/README.md)、[实际仓库状态](https://api.github.com/repos/FlowiseAI/Flowise)。

**仍可成立的任务。** 导入既有 flow JSON → 展示节点、变量、工具和外部服务依赖 → 用固定样例对照旧实例输出 → 生成迁移清单。调用既有服务时，Prediction API 的 `/api/v1/prediction/{id}` 支持 `question` 或 Agentflow V2 `form`、`overrideConfig`、`humanInput`，响应可含 `json`、`sourceDocuments`、`usedTools`。以结构化迁移与回归比较为主，不重复做第三个可视化聊天图编辑器。[Prediction API](https://docs.flowiseai.com/api-reference/prediction)。

**模板适配。** README 泛称 Node ≥20，但当前 server 包实际 `engines: ^24`，且有 `sqlite3`、`connect-sqlite3`；应以锁定版本的包声明与依赖为准，不能依据 README 判 Node 22 已适配。外部已有实例可通过 Node 同源 API 访问，React 19 自建迁移视图，SQLite 保存 flow 原件和映射。解析 flow JSON 不需模型；验证旧运行结果需实例及模型。[server 清单](https://github.com/FlowiseAI/Flowise/blob/main/packages/server/package.json)。

**许可。** 非例外部分是 Apache-2.0；根 LICENSE 明确 `packages/server/src/enterprise` 以及带明确版权声明的文件（示例 `IdentityManager.ts`）适用 Commercial License。EE 生产使用要求有效订阅/协议，不能自由复制分发；归档与公告中的 Apache 表述没有把 EE 自动改成 Apache。迁移器不复制这些模块。[根许可](https://github.com/FlowiseAI/Flowise/blob/main/LICENSE.md)、[EE 许可](https://github.com/FlowiseAI/Flowise/blob/main/packages/server/src/enterprise/LICENSE.md)。

## 维护证据快照

以下为 2026-10-27 读取 GitHub 官方仓库 API 的结果，日期均为 UTC。`pushed_at` 表示仓库有 push，不等于稳定发行、不等于安全维护承诺，也不以 stars 代替维护判断。链接指向实时元数据，之后可能变化。

| 项目 | archived | 最近 pushed_at 日期 | 官方证据 |
|---|---|---|---|
| Promptfoo | false | 2026-10-27 | [API](https://api.github.com/repos/promptfoo/promptfoo) |
| Langfuse | false | 2026-10-27 | [API](https://api.github.com/repos/langfuse/langfuse) |
| Langflow | false | 2026-10-27 | [API](https://api.github.com/repos/langflow-ai/langflow) |
| Flowise | **true** | 2026-08-13 | [API](https://api.github.com/repos/FlowiseAI/Flowise) |
| Dify | false | 2026-10-27 | [API](https://api.github.com/repos/langgenius/dify) |
| Mastra | false | 2026-10-27 | [API](https://api.github.com/repos/mastra-ai/mastra) |
| LangGraph.js | false | 2026-10-27 | [API](https://api.github.com/repos/langchain-ai/langgraphjs) |
| browser-use | false | 2026-10-27 | [API](https://api.github.com/repos/browser-use/browser-use) |
| OpenHands | false | 2026-10-27 | [API](https://api.github.com/repos/OpenHands/OpenHands) |
| Ragas | false | 2026-02-24 | [API](https://api.github.com/repos/vibrantlabsai/ragas) |

## 前三项的最小验证范围

1. **LangGraph.js：一条可恢复的资料复核流程。** 固定三个节点：结构化提取、人工复核、生成交付 JSON。Node 端真实执行核心库；先完成模板 SQLite checkpointer，再验证进程重启后从同一 `thread_id` 恢复、重复提交不会重复写入、模型失败后状态可见。AI adapter 未连接时只允许查看/编辑资料，不能把固定样例当成模型结果。产物是可编辑记录、真实执行时间线和 JSON。
2. **Promptfoo：一组真实评测结果的基线比较。** 从固定版本 Promptfoo 产生的 JSON 开始，完成导入、矩阵、失败细节和差异导出；下一步加明确配置的外部 runner，一次只执行一个受限评测套件。必须保存 provider/model、prompt、用例、断言、版本、错误和评测时间，无法重放的 transform 显式标注。直接安装整个 npm 包是后续独立验证，不能为了排名绕过 native 依赖限制。
3. **Langfuse：一个已有项目的 trace 审阅。** 锁定兼容的服务/SDK 版本，Node 同源读取一页 observations 并展开单条 trace；随后加人工评分与“生成回归用例”导出。先验证分页、缺少 span、异步入库、远端认证失败和重复写分数；不用部署完整 Langfuse，也不使用 EE 管理能力。

三项共同验收只在后续实现时进行：固定依赖和许可清单；模板 build/check；真实输入→上游引擎/服务→输出；浏览器同源/CSP；自动保存与冲突；重开后的原始附件可恢复；打包与真实 Host/导入客户端分别记录。此次研究没有执行这些步骤，所有“可接入”均为有证据支持的工程路线判断。
