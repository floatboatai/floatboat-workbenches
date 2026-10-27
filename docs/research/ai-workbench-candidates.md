# AI 工作台选型：32 个项目

核查日期：**2026-10-27**。三个研究子代理分别核查知识与研究、Agent 与评测、创作与语音，主线程补充交互组件和推理基础库。与立项前 `catalog.json` 的 55 个项目按上游仓库去重后，本次研究 **32 个新项目**：29 个产品/任务引擎与 3 个通用组件，包含 2 个已归档的参考项。

**建议先验证 LangExtract、Docling、LangGraph.js、Promptfoo、faster-whisper、Presenton。** 它们分别产出可复核的记录、文档结构、可恢复流程、评测报告、字幕和课件，容易定义真实输入输出。随后根据服务条件增加 LightRAG、Langfuse、Kokoro 和 ComfyUI。

**实现更新（0.4.0）**：LangExtract、Docling、LangGraph.js、Promptfoo、faster-whisper、Presenton 已完成本地功能验收；仓库为 **32 / 61 项**，其余26个AI候选仍为研究状态。模型与上游服务的真实执行范围、尚未验证项见[发布验收](../release-0.4.0.md)。下文保留初筛时的工作流与排序，不能据此扩大已实现范围。

## 下一批怎么排

1. **先定义六个独立闭环。** LangExtract 做字段和原文证据复核；Docling 做解析结果校对；LangGraph.js 做人工中断与恢复；Promptfoo 做真实评测结果比较；faster-whisper 做字幕编辑；Presenton 做材料、大纲、生成和导出。各自建立可保存项目，再接真实引擎或服务。
2. **按已有设施补四项。** 有知识索引服务就做 LightRAG，有观测平台就做 Langfuse；需要固定声音旁白时做 Kokoro，有模型/GPU 服务时做 ComfyUI。Kokoro 需先通过当前依赖和中文试听验证，不能忽略较久未推送的维护信号。
3. **更重的产品后排。** RAGFlow、Onyx、WrenAI、OpenHands、Wan2.2 需要更多基础设施或版本适配。Flowise、IOPaint 不作为默认新建依赖；F5-TTS 官方权重带非商用限制，暂不作为默认商业配音后端。

这个顺序综合产品差异、接口清晰度、模板适配量和外部设施。它不是热门程度排名，也不是完成时间承诺。分领域笔记中的 P0/P1/A 等是组内排序；实施顺序以本页为准。

## 文档、知识与研究：9 项

接口、模型、依赖与许可原文见[知识与研究详细核查](ai-knowledge-candidates.md)。

| ID | 上游项目 | 建议产品与原生布局 | 接入条件 | 选择判断 |
| --- | --- | --- | --- | --- |
| AI01 | [LangExtract](https://github.com/google/langextract) | 字段抽取复核：原文高亮与记录表联动 | Python 核心＋自建任务服务；Apache-2.0 | **首批**；文本输入，保留证据区间与人工修订 |
| AI02 | [Docling](https://github.com/docling-project/docling) | 文档解析校对：原页、结构树、表格修订 | 官方 docling-serve；代码 MIT，模型单列 | **首批**；CPU 服务可起步，处理部分解析失败 |
| AI03 | [LightRAG](https://github.com/HKUDS/LightRAG) | 知识关系检查：图谱、来源片段、检索对照 | Python 服务＋LLM/embedding；MIT | **有服务后优先**；先只读图谱和检索 |
| AI04 | [GPT Researcher](https://github.com/assafelovic/gpt-researcher) | 研究报告台：稿件、大纲、引用核查抽屉 | Python＋模型/搜索；根 Apache-2.0 与包 MIT 元数据冲突 | 后续；先固定版本、确认许可依据 |
| AI05 | [Open Notebook](https://github.com/lfnovo/open-notebook) | 资料阅读台：来源树、双页阅读、知识卡片 | Python＋SurrealDB；应用 MIT，数据库另计 | 后续；已有实例时优先 |
| AI06 | [WrenAI](https://github.com/Canner/WrenAI) | 指标和 SQL 审查：模型树、SQL、结果表 | 当前 Python/Rust 语义核心；路径许可映射 | 专项；旧 Classic 已停止维护，不沿用旧 UI 立项 |
| AI07 | [RAGFlow](https://github.com/infiniflow/ragflow) | 文档入库质检：解析队列、原页/切片、召回表 | 当前 Go/native 多服务；Apache-2.0 | 专项；已有 Linux 服务时更合适 |
| AI08 | [Onyx](https://github.com/onyx-dot-app/onyx) | 企业证据检索：结果、原文、证据篮、同步状态 | 已部署索引与权限；MIT 核心＋EE | 专项；按真实用户权限访问 |
| AI09 | [Khoj](https://github.com/khoj-ai/khoj) | 私人资料检索：来源筛选、命中段落、收藏集 | Python＋PostgreSQL/pgvector；AGPLv3 | 后续；更适合已有用户 |

## Agent、评测与运行复盘：10 项

接口、版本、存储适配和商业扩展范围见[Agent 详细核查](ai-agent-candidates.md)。

| ID | 上游项目 | 建议产品与原生布局 | 接入条件 | 选择判断 |
| --- | --- | --- | --- | --- |
| AI10 | [LangGraph.js](https://github.com/langchain-ai/langgraphjs) | 人工复核流程：执行图、待办卡、检查点时间线 | Node 核心＋自建模板 SQLite checkpointer；MIT | **首批**；不能照搬 better-sqlite3 adapter |
| AI11 | [Promptfoo](https://github.com/promptfoo/promptfoo) | 评测台：用例×版本矩阵、失败差异、基线 | 外部 runner/真实结果导入；MIT | **首批**；当前 Node 最低补丁与 libSQL 依赖须处理 |
| AI12 | [Langfuse](https://github.com/langfuse/langfuse) | 运行复盘：span 瀑布图、成本、人工评分 | JS/REST 接已有服务；MIT 核心＋EE | **有服务后优先**；不移植整个服务集群 |
| AI13 | [Mastra](https://github.com/mastra-ai/mastra) | 批次加工：任务表、步骤输出、人工回填 | Node 核心＋存储适配；Apache-2.0＋EE | 后续；与 LangGraph 先二选一 |
| AI14 | [Langflow](https://github.com/langflow-ai/langflow) | 字段提取：原文、schema、复核结果三栏 | 外部 Python flow API；MIT | 后续；适合已有流程服务 |
| AI15 | [Dify](https://github.com/langgenius/dify) | 知识库运营：文档/索引队列、检索测试、运行记录 | 外部平台 API；带附加条款的 Apache 派生许可 | 有实例再做；单 workspace、前端和多租户边界分开核对 |
| AI16 | [Ragas](https://github.com/vibrantlabsai/ragas) | RAG 评测：问题、答案、检索证据、评分分歧 | Python evaluator＋按指标配置 judge；Apache-2.0 | 后续；分数不等于事实正确证明 |
| AI17 | [browser-use](https://github.com/browser-use/browser-use) | 网页采集复核：任务队列、步骤截图、数据行 | 外部 Python/browser/model 服务；MIT | 后续；先限定采集与审阅流程 |
| AI18 | [OpenHands](https://github.com/OpenHands/OpenHands) | 工程任务审阅：执行轨迹、diff、测试结果 | 外部 Agent 后端；当前 Canvas Node ≥24；MIT | 暂缓；不直接移入固定 Node 22 模板 |
| AI19 | [Flowise](https://github.com/FlowiseAI/Flowise) | 既有流程迁移：节点/变量检查、结果比较 | 现有实例/JSON；Apache-2.0 核心＋商业 EE | **新建不选**；官方 EOL、仓库已归档 |

## 语音、图像、视频与演示：10 项

真实接口、CPU/GPU 条件与逐个模型许可见[创作与语音详细核查](ai-creative-candidates.md)。

| ID | 上游项目 | 建议产品与原生布局 | 接入条件 | 选择判断 |
| --- | --- | --- | --- | --- |
| AI20 | [faster-whisper](https://github.com/SYSTRAN/faster-whisper) | 字幕审校：波形、逐句回听、时间轴、术语表 | 自建 Python 任务服务，CPU 可起步；MIT | **首批**；导出 SRT/VTT/逐字稿，保存人工修订 |
| AI21 | [Presenton](https://github.com/presenton/presenton) | 课件制作：逐页大纲、幻灯片舞台、资料引用 | 外部 Docker/self-host API；Apache-2.0 | **首批**；Electron 版不提供外部 REST/MCP |
| AI22 | [Kokoro](https://github.com/hexgrad/kokoro) | 旁白台：分段脚本、试听、声音/速度、音轨 | Python TTS；代码与指定 Kokoro-82M 权重 Apache-2.0 | **条件优先**；最后 push 2025-08，先验证依赖与语音效果 |
| AI23 | [WhisperX](https://github.com/m-bain/whisperX) | 访谈精编：说话人泳道、逐字稿、低置信片段 | Python＋转写/对齐/分离模型；代码 BSD-2-Clause | 后续；多人分离需求明确时选择 |
| AI24 | [FunASR](https://github.com/modelscope/FunASR) | 中文审听：录音批次、术语修订、事件标签 | Python/HTTP；代码 MIT，模型含自定义条款 | 后续；固定模型与响应合约后验证 |
| AI25 | [ComfyUI](https://github.com/Comfy-Org/ComfyUI) | 视觉素材生产：配方、参数、生成队列、对比墙 | 外部模型/GPU 服务；后端 GPL-3.0，权重单列 | **有设施后优先**；先固定图像配方，再扩视频 |
| AI26 | [InvokeAI](https://github.com/invoke-ai/InvokeAI) | 局部改图：大画布、蒙版、版本、前后对照 | Python 3.12 与模型服务；代码 Apache-2.0 | 后续；适合连续修图，完整画布另行适配 |
| AI27 | [Wan2.2](https://github.com/Wan-Video/Wan2.2) | 短片分镜：镜头卡、参考图、播放器、多版本 | 外部 GPU worker；代码与指定 TI2V-5B 权重 Apache-2.0 | 专项；官方 TI2V-5B 路线需至少 24GB VRAM |
| AI28 | [IOPaint](https://github.com/Sanster/IOPaint) | 修补参考：蒙版、原图/结果滑杆、历史 | 既有 Python 实例；代码 Apache-2.0 | **新建不选**；已归档，转换权重来源许可未完整核清 |
| AI29 | [F5-TTS](https://github.com/SWivid/F5-TTS) | 配音实验：参考素材、角色脚本、试听时间轴 | Python；代码 MIT，官方权重 CC-BY-NC-4.0 | 暂缓默认商业用途；代码许可不覆盖权重限制 |

## 可复用组件：3 项

这三项不单独计为完整业务产品。实际接口与运行时关卡见[集成组件核查](ai-integration-components.md)。

| ID | 上游项目 | 适合复用的部分 | 许可与关卡 | 选择判断 |
| --- | --- | --- | --- | --- |
| AI30 | [CopilotKit](https://github.com/CopilotKit/CopilotKit) | 上下文、结构化操作预览、Agent 状态交互 | MIT；需 Host/AG-UI 适配，Intelligence 另计 | 为明确业务操作按需引入 |
| AI31 | [assistant-ui](https://github.com/assistant-ui/assistant-ui) | 消息/工具部件、对话分支、外部状态适配 | MIT；React 包支持 19，整仓构建要求 Node 24.11+ | 作为局部 UI，不直接复制整仓 |
| AI32 | [Transformers.js](https://github.com/huggingface/transformers.js) | 分类、标注、音频等本地推理引擎 | Apache-2.0；模型单列；浏览器 WASM/CSP 和 Node native 关卡 | 暂缓内嵌，保留独立推理服务路线 |

## 实现时沿用的产品标准

**自动保存。** 保存用户正在编辑的完整草稿、输入版本、人工修订和结果，而不是只保存模型回答。任务提交前持久化业务操作 ID；服务有幂等键时使用它，没有时通过任务记录和对账避免盲目重提。刷新后查询原任务，不重复启动收费生成。分别呈现已保存、运行中、部分成功、失败、取消和冲突；重生成新建结果版本，不悄悄覆盖手工改动。遵循[现有自动保存契约](../../scripts/blueprints/AUTOSAVE.md)。

**按原生任务设计。** 字段审校以原文和记录为中心，字幕以波形和时间轴为中心，评测以矩阵为中心，配音以分段脚本为中心，图片以画布或素材墙为中心。先确定主要工作对象和操作空间，再写每个项目的 `app/DESIGN.md`；配色只是其中一部分。遵循[现有设计原则](../design-principles.md)，各工作台验收后补真实截图。

**真实接入。** 固定模板是 Node 22、React 19、SQLite 和同源 CSP；Python、GPU、模型下载及平台数据库放在独立服务。LLM/Agent/ASR Host SDK 不是通用 OpenAI HTTP 地址，不自动包含 embedding、reranker、搜索或 TTS。需要连接器时先验证协议、服务可达性和失败状态；没有连接就明确显示。用 Host 模拟相似结果不能冒称已接入指定上游。

**可恢复资产。** 原件、音频、模型结果、导出文件和引用定位要绑定稳定资源与版本，不只保存临时 URL。记录真实服务与模型版本；断线重新连接现有任务。业务数据自动保存和模型任务继续运行是两个问题，应分别验收。

**准确验收。** 每项先做一次真实输入→上游执行→人工修订→重开恢复→导出；测试服务不可达、部分失败、重复请求、取消和长任务恢复。记录本地 build/浏览器验收、真实 Host 调用、客户端导入三个层级，不能混成一个“完成”。许可按实际固定源码、依赖、权重、字体/素材和所用企业模块核对；当前表只记录已核事实，没有替整个依赖树做分发结论。

## 研究文件

- [知识与结构化数据](ai-knowledge-candidates.md)：9 项。
- [Agent、评测与观测](ai-agent-candidates.md)：9 个候选＋Flowise 排除说明。
- [语音与创意生产](ai-creative-candidates.md)：10 项，含 IOPaint、F5-TTS 条件/观察项。
- [交互与推理基础组件](ai-integration-components.md)：3 项。
- [结构化研究清单](ai-candidates.json)：32 个唯一上游，6项本地功能已验收、26项保留研究状态；每项的上游执行范围单列。

来源以官方仓库、许可证、模型卡和维护者文档为主。维护信号和版本来自核查当日，开始实现时仍需固定 release/commit 并复核对应接口；`pushed_at` 不等于正式版本，也不证明稳定性。
