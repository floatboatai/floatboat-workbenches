# 0.5.0 · X选题与设计工作台

2026-10-28。12个工作台通过本地构建、132项应用测试、33项独立服务测试、17项仓库工具测试和真实Chrome验收；从合并后的主仓库生成12个源码包，逐个检查ZIP CRC、源码/资源字节、身份和版本、许可证与数据排除。客户端导入尚未实测。

本次包括9个X选题与3个设计项目，目录总数72，其中44项完成本地功能验收。旧批次不改版本、不重复计算测试。工作在4个独立worktree中完成，最多主代理加3个子代理并行。

## 实际运行范围

| 项目 | 完成流程 | 实际引擎/验证边界 |
| --- | --- | --- |
| [Penpot](../workbenches/44-penpot/ACCEPTANCE.md) | 颜色、字体、组件样本与交付说明，原生Penpot归档及CSS导出 | 真实@penpot/library 1.2.0生成原生归档；外部Penpot导入未验证 |
| [HyperFrames](../workbenches/62-hyperframes/ACCEPTANCE.md) | 镜头文字与构图、时间线、HyperFrames HTML和真实MP4渲染 | 真实hyperframes 0.8.210渲染MP4 |
| [Graphify](../workbenches/63-graphify/ACCEPTANCE.md) | 真实AST抽取、原生图谱、关系路径、布局与审阅笔记 | 真实graphifyy 0.9.97 AST提取；语义LLM提取未启用 |
| [PageIndex](../workbenches/64-pageindex/ACCEPTANCE.md) | PDF章节与原页、便笺、Gemini 3.8问答和逐字页码引用 | 真实PageIndex 0.2.10 Flash、PDFium及Gemini 3.8问答 |
| [DeepTutor](../workbenches/65-deeptutor/ACCEPTANCE.md) | 讲义、真实Host出题、上游批改与复习排程、课程导出 | 真实DeepTutor批改/排程及Gemini 3.8出题 |
| [Agent-Reach](../workbenches/66-agent-reach/ACCEPTANCE.md) | GitHub、网页、V2EX来源采集、去重收藏、摘录与审阅导出 | 真实Agent-Reach 1.6.0 GitHub读取/搜索、Jina网页和V2EX热门 |
| [OpenMontage](../workbenches/67-openmontage/ACCEPTANCE.md) | 上传原片、入出点、镜头复核、上游组接和MP4交付 | 真实OpenMontage裁切/组接；未启用AI视频生成 |
| [DeerFlow](../workbenches/68-deerflow/ACCEPTANCE.md) | 研究提交、原生线程运行查询、来源复核和报告交付 | 真实官方序列化器与请求模型；运行HTTP契约通过，真实研究服务未验证 |
| [MiroFish](../workbenches/69-mirofish/ACCEPTANCE.md) | 已准备模拟的启动/停止、状态核对、原生动作与人工复核 | 原生动作格式与运行HTTP契约通过；真实OASIS/Zep模拟未验证 |
| [GEOInflow](../workbenches/70-geoinflow/ACCEPTANCE.md) | 日志与内容清单、原生UA/引荐分类、覆盖分析和审阅导出 | 真实GEOInflow分类与严格日期核心；未做IP/DNS核验或线上采集 |
| [OpenPencil](../workbenches/71-openpencil/ACCEPTANCE.md) | 图层与属性、原生SceneGraph、FIG/SVG及完整项目导出 | 真实OpenPencil 0.16.0核心与FIG编码；CanvasKit画布等待WASM支持 |
| [FigCraft](../workbenches/72-figcraft/ACCEPTANCE.md) | 原生设计画板、文案校订、交付状态和PNG/SVG/PDF导出 | 真实FigCraft CLI 0.11.2 CPU渲染及原生文档 |

PageIndex和DeepTutor均通过真实Floatboat Host的`gemini-3.8-flash`调用。DeerFlow的默认模型名称通过官方请求字段发送，仍需部署端模型白名单支持；其HTTP合同样例不能算真实研究运行。MiroFish的启动/停止也只验证官方协议和状态恢复，未运行真实OASIS/Zep模型。

## 保存与失败恢复

每项保留完整工作副本、未应用输入、自动保存状态和恢复稿导入新副本。验收覆盖保存期间继续输入、提交成功后丢回执、刷新恢复、旧窗口冲突、导航等待旧保存、无效草稿和窄屏交互。异步任务先保存本地命令；未知回执按各服务支持的幂等规则恢复。导入的历史命令仅作来源，不自动执行。

PageIndex恢复稿不包含PDF，缺失时补齐原PDF；OpenMontage恢复稿不包含视频原件，需重新选择原件或使用完整工程。浏览器本机恢复限定同源；多窗口同时提交同一未确认工作稿时可能进入明确冲突，不能自动覆盖另一个窗口。

MiroFish上游没有条件run_id停止接口；以simulation_id与started_at预检后调用，无法原子排除外部客户端恰好重启的竞态。界面与[运行接入](../workbenches/69-mirofish/RUN-INTEGRATION.md)要求同一模拟由一个入口管理。

## 交付与限制

所有应用使用固定模板`3b55d46f7ae25e939ce3299073c37ed334d69c02`，未修改下载的SDK、工具链或CSP。OpenPencil当前采用真实Node SceneGraph、FIG编码和SVG路线；完整CanvasKit浏览器画布等待用户正在开发的WASM支持。FigCraft当前通过独立CLI完成CPU渲染，不把替代预览声明为完整上游GUI。

各产品入口、源码、配置与独立服务安装方式见[服务说明](batch-0.5-services.md)。包内不含模型、外部服务、预览数据或凭据；外部服务源码随交付ZIP的support目录另附，依赖需依说明安装。

README提供44项真实截图；本批12张均由真实Chrome拍摄，普通示例与未连接状态明确标示。未做界面合成或图片修饰。哈希与尺寸见[截图说明](screenshots/README.md)，最终包哈希与逐项字节校验见[机器可读验收](release-0.5.0.json)。

较大模块警告主要来自统一自动保存、原生数据目录与复杂工作台；没有绕过构建或类型校验。测试与本地预览通过不代表已完成Floatboat客户端导入验收。

## 远端CI与许可合并

保留远端PR #1的自动打包/介绍图协议和PR #2的原创封装MIT许可，12项新项目均加入介绍图配置并附带范围明确的`application/LICENSE`，第三方声明保持原样。12份本地CI介绍资料包及17项仓库工具测试通过；线上GitHub Actions结果另行核验，不把本地打包当作线上运行。依赖外部服务的项目已在包内登记配置指南资源。

补充Linux验证：在既有`node:22-bookworm`容器内只读挂载源码、禁用网络，以各项目根目录为工作目录执行12项共132个应用测试，全部通过。该运行使用Node22.23.3，未替代GitHub Ubuntu24.04/Node22.22.2的完整依赖安装与构建。GEOInflow来源清单已移入随包导出的src目录，并复验13项测试。

线上补验：[GitHub Actions](https://github.com/floatboatai/floatboat-workbenches/actions/runs/40637769141) 已在发布提交 `5ec93c34997d192a8ddcfb34931aed5ddd6d77de` 上全部通过；所有44个工作台完成Ubuntu/Node22.22.2检查、测试、打包与介绍图产物交付。后端上传作业按配置跳过，不代表已公开上架。
