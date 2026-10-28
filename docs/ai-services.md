# AI 工作台的运行方式

0.4.0 的六个工作台都有本地项目、自动保存、草稿恢复、人工编辑和导出。模型与上游服务按下表独立配置。普通 `.fbworkbench` 是源码包，不包含运行中的服务、模型权重、凭据或开发预览数据；客户端导入尚未实测。

| 工作台 | 无外部服务时可用 | 执行新任务所需 | 本次真实执行证据 |
| --- | --- | --- | --- |
| [LangExtract](../workbenches/56-langextract/README.md) | 文本/字段编辑、JSONL证据复核、修订与导出 | 独立Python LangExtract服务及模型提供方 | 真实库管线＋明确stub模型，非模型推理 |
| [Docling](../workbenches/57-docling/README.md) | DoclingDocument JSON结构、文本和表格校订 | 官方Docling Serve；本版提交HTML | 真实Docling core的HTML转换与校订JSON回读；Serve live未测 |
| [LangGraph.js](../workbenches/58-langgraph/README.md) | 填写资料、真实流程执行、人工暂停/恢复、交付记录 | 模型整理分支需要已连接Floatboat Host | 真实StateGraph/SQLite检查点及进程重启；0.4.1已验证Gemini 3.8 Host完整流程 |
| [Promptfoo](../workbenches/59-promptfoo/README.md) | 结果矩阵、基线比较、人工复核、原始结果/CSV | 独立Node执行器；模型模式另配提供方 | 真实Promptfoo evaluator回显评测，非模型质量评测 |
| [faster-whisper](../workbenches/60-faster-whisper/README.md) | 音频保存/回听、字幕编辑和导出 | 独立Python推理服务及指定模型 | tiny.en CPU INT8真实转写，短英语录音完整链路 |
| [Presenton](../workbenches/61-presenton/README.md) | 素材、大纲、逐页审阅和便携文稿 | 已部署Presenton服务、其API key与模型 | 接口合同与本地任务流程；真实生成/PPTX/PDF文件递送未测 |

## 本地预览

从仓库根目录运行 `pnpm workbench prepare <slug>`，再运行 `pnpm workbench dev <slug>`。工作台页面只访问自己的同源接口，Node服务再连接预先配置的上游。工作台中不能填写模型密钥；服务端环境配置不随项目/源码包导出。

可以采用以下同机端口分配，避免不同服务占用同一端口；这不是自动部署命令：

| 服务 | 示例地址 | 工作台进程的配置变量 |
| --- | --- | --- |
| LangExtract adapter | `http://127.0.0.1:8767` | `LANGEXTRACT_SERVICE_URL`、`LANGEXTRACT_SERVICE_TOKEN` |
| faster-whisper adapter | `http://127.0.0.1:8768` | `FASTER_WHISPER_URL`、可选 `FASTER_WHISPER_TOKEN` |
| Promptfoo runner | `http://127.0.0.1:8770` | `PROMPTFOO_RUNNER_URL`、可选 `PROMPTFOO_RUNNER_TOKEN` |
| Docling Serve | `http://127.0.0.1:5001` | `DOCLING_SERVE_URL`、按服务配置 `DOCLING_SERVE_API_KEY` |
| Presenton | `http://127.0.0.1:5002` | `PRESENTON_URL`、`PRESENTON_API_KEY` |

每个项目README给出精确依赖和启动方法。Presenton官方示例常用5001端口，同时运行Docling时应将其主机端口映射为5002并对应修改URL。远程地址使用HTTPS，来源/鉴权约束按各连接器校验。不要把模型key写进公开脚本、项目JSON或截图。

LangGraph模型整理走真正的Host SDK，由Floatboat管理模型与凭据。0.4.1默认显式请求 `gemini-3.8-flash`，真实调用、人工复核、交付及刷新恢复已通过，见[0.4.1验收](release-0.4.1.md)。这是LangGraph的应用默认值；其他Python/HTTP服务仍独立配置。LangExtract目前没有Host→Python provider bridge。

## 保存与任务恢复

编辑草稿与运行任务分开保存。完成的模型结果先进入独立结果/新项目，避免覆盖正在修改的内容。提交回执不明确时保留原操作标识并查询；仅在后端明确提供幂等协议时重试同一任务。Presenton/Docling的上游提交不按通用HTTP幂等服务处理；未确认时需要关联原任务或明确决定后续操作。

每项有自己的容量上限。超过正式模型上限的未完成输入会保持草稿状态；支持恢复的工作稿仍有独立边界。UI会区分服务器保存、未完成草稿、本机保留、离线和冲突。IndexedDB恢复限定同一浏览器来源；改变预览端口或换设备不会自动迁移本机离线副本。较大资料应拆分项目，或使用便携导出转移。

源码包默认不包含业务数据。Python与执行器目录随Git仓库提供；部署后端与安装工作台是两个步骤。批次验收、版本与各项限制见[0.4.0验收](release-0.4.0.md)。
