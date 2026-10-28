# Floatboat Workbenches

把成熟的 GitHub 项目接入 Floatboat，提供可编辑、自动保存、可导出的业务工作台。

一个项目一个目录。只有完成实际检查的项目才标记为已实现；计划目录不代表已经可用。

## 当前进度

当前批次 **0.5.0** · **44 / 72 个工作台已完成本地功能验收**，其余28个为计划项目。本批转换9个X选题及OpenPencil、FigCraft、Penpot，共12项。Floatboat客户端导入尚未实测。

在4个独立worktree并行实现，最多主代理加3个子代理同时工作。每项均验证自动保存、未完成草稿、恢复稿回导、冲突和产品专属布局；真实引擎与服务契约的区别见[0.5.0验收](docs/release-0.5.0.md)，启动条件见[本批服务说明](docs/batch-0.5-services.md)。OpenPencil的CanvasKit画布升级等待客户端和模板WASM支持；现有原生FIG/SceneGraph流程可用。

| 项目 | 已实现流程 | 界面方向 |
| --- | --- | --- |
| [Excalidraw](workbenches/01-excalidraw/) | 白板编辑、保存恢复、PNG/SVG/源文件导入导出 | 全幅原生画布 |
| [Markmap](workbenches/02-markmap/) | Markdown 大纲、交互脑图、独立 SVG 导出 | 脑图主屏与可收起大纲 |
| [pdfme](workbenches/03-pdfme/) | 文本/矩形版式、中文字段、多页 PDF 导出 | 排版台、页面轨与字段栏 |
| [Tiptap](workbenches/04-tiptap/) | 富文本编辑、JSON/HTML 导出 | 专注写作页 |
| [PptxGenJS](workbenches/05-pptxgenjs/) | 幻灯片编排、主题、演讲备注、PPTX 导出 | 黑色舞台、缩略图与备注 |
| [React Flow](workbenches/06-react-flow/) | 节点编辑、单链文本变换、实际运行结果 | 节点 IDE 与运行控制台 |
| [SurveyJS Form Library](workbenches/07-surveyjs-form-library/) | 问卷设计、填写、答卷保存与导出 | 分阶段表单 |
| [Mermaid](workbenches/08-mermaid/) | 源码绘图、错误恢复、源码/SVG 导出 | 源码 IDE 与图形预览 |
| [Swagger UI](workbenches/09-swagger-ui/) | OpenAPI 文档、JSON 编辑、同源 GET 试调 | 端点目录与 API 参考台 |
| [Vega-Lite](workbenches/10-vega-lite/) | JSON 规格、内嵌数据绘图、SVG 导出 | 图表实验台与规格检查器 |
| [Observable Plot](workbenches/11-observable-plot/) | CSV/JSON 数据、字段映射、三种图表、SVG 导出 | 数据观察报告 |
| [BlockNote](workbenches/18-blocknote/) | 知识页、嵌套块/任务/表格、Markdown/HTML/JSON 导出 | 知识夹、页面目录与块式正文 |
| [MDXEditor](workbenches/19-mdxeditor/) | Markdown 富文本/源码/差异、比较基准、审阅意见 | 稿件与审阅边栏 |
| [Milkdown](workbenches/20-milkdown/) | 原生 Markdown 写作、标签/大纲/专注、页边笔记 | 个人笔记库与写作页 |
| [PDF.js](workbenches/21-pdf-js/) | PDF 阅读/检索、逐页笔记、原件与便携项目导出 | 深色阅读台与页边笔记 |
| [reveal.js](workbenches/22-reveal-js/) | Markdown 演示、页序/备注、排练与离线 HTML | 横向页带与演示排练台 |
| [Univer](workbenches/23-univer/) | 网格编辑、公式/格式/多表、CSV 与工作簿 JSON | 原生表格、公式栏与工作表标签 |
| [Vditor](workbenches/24-vditor/) | 三模式 Markdown 编辑、阅读排版、Markdown/HTML/项目导出 | 文章目录与中文排版页 |
| [Fabric.js](workbenches/25-fabric-js/) | 文字/矩形/椭圆、几何/图层/画板、PNG/SVG/JSON | 对象化海报画板与检查器 |
| [Filerobot Image Editor](workbenches/26-filerobot-image-editor/) | 本地图片裁剪/调色/滤镜/标注、PNG/JPEG/完整工程 | 照片舞台与原生调节工具 |
| [GrapesJS](workbenches/27-grapesjs/) | 单页文字/布局/锚点、组件/图层/样式、HTML/CSS/项目 | 网页画布与组件、样式面板 |
| [Maker.js](workbenches/51-makerjs/) | 参数化零件、尺寸预览、SVG/DXF 导出 | 工程图纸与参数台 |
| [SeqViz](workbenches/52-seqviz/) | 序列导入、注释审阅、环形/线性视图与导出 | 序列审阅与注释轨道 |
| [farmOS-map](workbenches/53-farmos-map/) | 地块绘制、边界调整、备注与 GeoJSON 导出 | 地图与地块记录 |
| [Mirador](workbenches/54-mirador/) | 本地图像、双页对照、逐页复核与报告导出 | 双图光台与复核账本 |
| [OpenSheetMusicDisplay](workbenches/55-opensheetmusicdisplay/) | MusicXML/MXL 导入、谱面校审、批注及原件/SVG 导出 | 乐谱纸张与边注 |
| [LangExtract](workbenches/56-langextract/) | 原文、JSONL证据定位、字段复核、人工修订与CSV/JSONL/项目导出 | 原文纸张与证据账本 |
| [Docling](workbenches/57-docling/) | DoclingDocument结构树、文本/表格校订、顺序、JSON/Markdown/CSV与HTML连接器 | 结构轨、校样纸张与表格检查器 |
| [LangGraph.js](workbenches/58-langgraph/) | Gemini 3.8资料整理、真实StateGraph、人工复核、SQLite检查点与交付导出 | 三站复核流程与运行账本 |
| [Promptfoo](workbenches/59-promptfoo/) | 真实评测结果矩阵、基线、人工复核、限定套件执行器与CSV/JSON导出 | 用例×版本矩阵与结果对照 |
| [faster-whisper](workbenches/60-faster-whisper/) | 音频保存/回听、真实CPU转写、字幕时间编辑与SRT/VTT/完整项目导出 | 暗色波形、字幕行与任务队列 |
| [Presenton](workbenches/61-presenton/) | 资料、大纲、页序、备注、审阅、便携稿与异步制作服务连接器 | 逐页缩略轨、演示舞台与资料简报 |
| [Penpot](workbenches/44-penpot/) | 颜色、字体、组件样本与交付说明，原生Penpot归档及CSS导出 | 设计资产样本册与色彩、字体分页 |
| [HyperFrames](workbenches/62-hyperframes/) | 镜头文字与构图、时间线、HyperFrames HTML和真实MP4渲染 | 暗色动效舞台、镜头轨与输出队列 |
| [Graphify](workbenches/63-graphify/) | 真实AST抽取、原生图谱、关系路径、布局与审阅笔记 | 知识地图、符号目录与关系检查器 |
| [PageIndex](workbenches/64-pageindex/) | PDF章节与原页、便笺、Gemini 3.8问答和逐字页码引用 | 章节目录、纸张原页与审阅便笺 |
| [DeepTutor](workbenches/65-deeptutor/) | 讲义、真实Host出题、上游批改与复习排程、课程导出 | 对页练习本、答题区与复习清单 |
| [Agent-Reach](workbenches/66-agent-reach/) | GitHub、网页、V2EX来源采集、去重收藏、摘录与审阅导出 | 来源采集台、阅读正文与摘录夹 |
| [OpenMontage](workbenches/67-openmontage/) | 上传原片、入出点、镜头复核、上游组接和MP4交付 | 分镜制作单、原片预览与成片架 |
| [DeerFlow](workbenches/68-deerflow/) | 研究提交、原生线程运行查询、来源复核和报告交付 | 研究进度、交付纸张与来源证据页 |
| [MiroFish](workbenches/69-mirofish/) | 已准备模拟的启动/停止、状态核对、原生动作与人工复核 | 角色目录、轮次时间线与动作复核 |
| [GEOInflow](workbenches/70-geoinflow/) | 日志与内容清单、原生UA/引荐分类、覆盖分析和审阅导出 | 宽幅访问账本、范围筛选与逐页调查 |
| [OpenPencil](workbenches/71-openpencil/) | 图层与属性、原生SceneGraph、FIG/SVG及完整项目导出 | 全幅组件画板、图层与属性工具 |
| [FigCraft](workbenches/72-figcraft/) | 原生设计画板、文案校订、交付状态和PNG/SVG/PDF导出 | 暗色原型校样、画板序列与文案复核 |

0.4.0批次统一验证：**6项构建、106项应用测试、14项独立服务测试、3项工具测试和6个源码包**通过。真实上游执行包含LangGraph流程恢复、Promptfoo回显评测、Docling HTML转换和faster-whisper英语CPU转写；其他模型/服务条件见发布验收。

[LangGraph 0.4.1](docs/release-0.4.1.md) 默认使用 **Gemini 3.8 Flash**，已通过真实 Host 整理、人工复核、自动保存、交付及刷新恢复；17项应用测试通过，并补齐JSON代码块与日期格式兼容。其他独立AI服务的接入条件保持各项目说明。

既有26项的构建、208项应用测试与源码包记录见[0.3.0验收](docs/release-0.3.0.md)，本批未重跑未修改的既有应用。历史批次：[0.2.0](docs/release-0.2.0.md)、[2–11](docs/batch-02-11.md)。

仓库级 React Best Practices 与 Web Design Guidelines 已安装，入口见 `AGENTS.md`；各产品的设计原则见 [设计说明](docs/design-principles.md)。

X选题补充：[9个项目与转化优先级](docs/research/x-project-shortlist-2026-10-27.md)（2026-10-27，原帖、GitHub关注度与产品范围分开核验）。

行业补充调研：[28 个小众行业候选](docs/research/niche-industry-candidates.md)。Maker.js、SeqViz、farmOS-map、Mirador 与 OpenSheetMusicDisplay 已实现；其余候选仍处于研究或计划阶段。第12–17项的独立服务接入条件见各自目录。

AI 补充调研：[32 个 AI 项目与工作台选型](docs/research/ai-workbench-candidates.md)。覆盖文档抽取、知识图谱、Agent、评测、字幕、配音、课件和视觉生成，另含 3 个通用组件；已列明接口、独立服务、模型许可和维护边界。其中6项已完成本地功能验收，其余26项仍处于研究阶段；正式模型/外部服务范围以各项目说明为准。

## 工作台实景

以下为 44 个已验收本地工作台的真实 Chrome 界面，使用普通示例资料。点击预览进入项目说明；图片未经过界面合成或像素修饰。采集版本、原始尺寸与哈希见 [截图说明](docs/screenshots/README.md)。

| | |
| --- | --- |
| **[Excalidraw · 白板](workbenches/01-excalidraw/)**<br>[<img src="docs/screenshots/excalidraw.png" alt="Excalidraw · 白板工作台实景" width="440">](workbenches/01-excalidraw/) | **[Markmap · 脑图](workbenches/02-markmap/)**<br>[<img src="docs/screenshots/markmap.png" alt="Markmap · 脑图工作台实景" width="440">](workbenches/02-markmap/) |
| **[pdfme · 排版台](workbenches/03-pdfme/)**<br>[<img src="docs/screenshots/pdfme.png" alt="pdfme · 排版台工作台实景" width="440">](workbenches/03-pdfme/) | **[Tiptap · 写作](workbenches/04-tiptap/)**<br>[<img src="docs/screenshots/tiptap.png" alt="Tiptap · 写作工作台实景" width="440">](workbenches/04-tiptap/) |
| **[PptxGenJS · 演示](workbenches/05-pptxgenjs/)**<br>[<img src="docs/screenshots/pptxgenjs.png" alt="PptxGenJS · 演示工作台实景" width="440">](workbenches/05-pptxgenjs/) | **[React Flow · 工作流](workbenches/06-react-flow/)**<br>[<img src="docs/screenshots/react-flow.png" alt="React Flow · 工作流工作台实景" width="440">](workbenches/06-react-flow/) |
| **[SurveyJS Form Library · 问卷](workbenches/07-surveyjs-form-library/)**<br>[<img src="docs/screenshots/surveyjs.png" alt="SurveyJS Form Library · 问卷工作台实景" width="440">](workbenches/07-surveyjs-form-library/) | **[Mermaid · 图解](workbenches/08-mermaid/)**<br>[<img src="docs/screenshots/mermaid.png" alt="Mermaid · 图解工作台实景" width="440">](workbenches/08-mermaid/) |
| **[Swagger UI · API 文档](workbenches/09-swagger-ui/)**<br>[<img src="docs/screenshots/swagger-ui.png" alt="Swagger UI · API 文档工作台实景" width="440">](workbenches/09-swagger-ui/) | **[Vega-Lite · 图表规格](workbenches/10-vega-lite/)**<br>[<img src="docs/screenshots/vega-lite.png" alt="Vega-Lite · 图表规格工作台实景" width="440">](workbenches/10-vega-lite/) |
| **[Observable Plot · 数据](workbenches/11-observable-plot/)**<br>[<img src="docs/screenshots/observable-plot.png" alt="Observable Plot · 数据工作台实景" width="440">](workbenches/11-observable-plot/) | **[BlockNote · 知识夹](workbenches/18-blocknote/)**<br>[<img src="docs/screenshots/blocknote.png" alt="BlockNote · 知识夹工作台实景" width="440">](workbenches/18-blocknote/) |
| **[MDXEditor · 文档审阅](workbenches/19-mdxeditor/)**<br>[<img src="docs/screenshots/mdxeditor.png" alt="MDXEditor · 文档审阅工作台实景" width="440">](workbenches/19-mdxeditor/) | **[Milkdown · 写作笔记](workbenches/20-milkdown/)**<br>[<img src="docs/screenshots/milkdown.png" alt="Milkdown · 写作笔记工作台实景" width="440">](workbenches/20-milkdown/) |
| **[PDF.js · PDF 阅读](workbenches/21-pdf-js/)**<br>[<img src="docs/screenshots/pdf-js.png" alt="PDF.js · PDF 阅读工作台实景" width="440">](workbenches/21-pdf-js/) | **[reveal.js · 演示排练](workbenches/22-reveal-js/)**<br>[<img src="docs/screenshots/reveal-js.png" alt="reveal.js · 演示排练工作台实景" width="440">](workbenches/22-reveal-js/) |
| **[Univer · 电子表格](workbenches/23-univer/)**<br>[<img src="docs/screenshots/univer.png" alt="Univer · 电子表格工作台实景" width="440">](workbenches/23-univer/) | **[Vditor · 文章写作](workbenches/24-vditor/)**<br>[<img src="docs/screenshots/vditor.png" alt="Vditor · 文章写作工作台实景" width="440">](workbenches/24-vditor/) |
| **[Fabric.js · 海报排版](workbenches/25-fabric-js/)**<br>[<img src="docs/screenshots/fabric-js.png" alt="Fabric.js · 海报排版工作台实景" width="440">](workbenches/25-fabric-js/) | **[Filerobot Image Editor · 图片编辑](workbenches/26-filerobot-image-editor/)**<br>[<img src="docs/screenshots/filerobot-image-editor.png" alt="Filerobot Image Editor · 图片编辑工作台实景" width="440">](workbenches/26-filerobot-image-editor/) |
| **[GrapesJS · 页面设计](workbenches/27-grapesjs/)**<br>[<img src="docs/screenshots/grapesjs.png" alt="GrapesJS · 页面设计工作台实景" width="440">](workbenches/27-grapesjs/) | **[Maker.js · 参数制图](workbenches/51-makerjs/)**<br>[<img src="docs/screenshots/makerjs.png" alt="Maker.js · 参数制图工作台实景" width="440">](workbenches/51-makerjs/) |
| **[SeqViz · 序列审阅](workbenches/52-seqviz/)**<br>[<img src="docs/screenshots/seqviz.png" alt="SeqViz · 序列审阅工作台实景" width="440">](workbenches/52-seqviz/) | **[farmOS-map · 地块](workbenches/53-farmos-map/)**<br>[<img src="docs/screenshots/farmos-map.png" alt="farmOS-map · 地块工作台实景" width="440">](workbenches/53-farmos-map/) |
| **[Mirador · 文献对照](workbenches/54-mirador/)**<br>[<img src="docs/screenshots/mirador.png" alt="Mirador · 文献对照工作台实景" width="440">](workbenches/54-mirador/) | **[OpenSheetMusicDisplay · 乐谱校审](workbenches/55-opensheetmusicdisplay/)**<br>[<img src="docs/screenshots/opensheetmusicdisplay.png" alt="OpenSheetMusicDisplay · 乐谱校审工作台实景" width="440">](workbenches/55-opensheetmusicdisplay/) |
| **[LangExtract · 原文纸张与证据账本](workbenches/56-langextract/)**<br>[<img src="docs/screenshots/langextract.png" alt="LangExtract 工作台实景" width="440">](workbenches/56-langextract/) | **[Docling · 结构轨、校样纸张与表格检查器](workbenches/57-docling/)**<br>[<img src="docs/screenshots/docling.png" alt="Docling 工作台实景" width="440">](workbenches/57-docling/) |
| **[LangGraph.js · 三站复核流程与运行账本](workbenches/58-langgraph/)**<br>[<img src="docs/screenshots/langgraph.png" alt="LangGraph.js 工作台实景" width="440">](workbenches/58-langgraph/) | **[Promptfoo · 用例×版本矩阵与结果对照](workbenches/59-promptfoo/)**<br>[<img src="docs/screenshots/promptfoo.png" alt="Promptfoo 工作台实景" width="440">](workbenches/59-promptfoo/) |
| **[faster-whisper · 暗色波形、字幕行与任务队列](workbenches/60-faster-whisper/)**<br>[<img src="docs/screenshots/faster-whisper.png" alt="faster-whisper 工作台实景" width="440">](workbenches/60-faster-whisper/) | **[Presenton · 逐页缩略轨、演示舞台与资料简报](workbenches/61-presenton/)**<br>[<img src="docs/screenshots/presenton.png" alt="Presenton 工作台实景" width="440">](workbenches/61-presenton/) |
| **[Penpot · 设计资产样本册与色彩、字体分页](workbenches/44-penpot/)**<br>[<img src="docs/screenshots/penpot.png" alt="Penpot 工作台实景" width="440">](workbenches/44-penpot/) | **[HyperFrames · 暗色动效舞台、镜头轨与输出队列](workbenches/62-hyperframes/)**<br>[<img src="docs/screenshots/hyperframes.png" alt="HyperFrames 工作台实景" width="440">](workbenches/62-hyperframes/) |
| **[Graphify · 知识地图、符号目录与关系检查器](workbenches/63-graphify/)**<br>[<img src="docs/screenshots/graphify.png" alt="Graphify 工作台实景" width="440">](workbenches/63-graphify/) | **[PageIndex · 章节目录、纸张原页与审阅便笺](workbenches/64-pageindex/)**<br>[<img src="docs/screenshots/pageindex.png" alt="PageIndex 工作台实景" width="440">](workbenches/64-pageindex/) |
| **[DeepTutor · 对页练习本、答题区与复习清单](workbenches/65-deeptutor/)**<br>[<img src="docs/screenshots/deeptutor.png" alt="DeepTutor 工作台实景" width="440">](workbenches/65-deeptutor/) | **[Agent-Reach · 来源采集台、阅读正文与摘录夹](workbenches/66-agent-reach/)**<br>[<img src="docs/screenshots/agent-reach.png" alt="Agent-Reach 工作台实景" width="440">](workbenches/66-agent-reach/) |
| **[OpenMontage · 分镜制作单、原片预览与成片架](workbenches/67-openmontage/)**<br>[<img src="docs/screenshots/openmontage.png" alt="OpenMontage 工作台实景" width="440">](workbenches/67-openmontage/) | **[DeerFlow · 研究进度、交付纸张与来源证据页](workbenches/68-deerflow/)**<br>[<img src="docs/screenshots/deerflow.png" alt="DeerFlow 工作台实景" width="440">](workbenches/68-deerflow/) |
| **[MiroFish · 角色目录、轮次时间线与动作复核](workbenches/69-mirofish/)**<br>[<img src="docs/screenshots/mirofish.png" alt="MiroFish 工作台实景" width="440">](workbenches/69-mirofish/) | **[GEOInflow · 宽幅访问账本、范围筛选与逐页调查](workbenches/70-geoinflow/)**<br>[<img src="docs/screenshots/geoinflow.png" alt="GEOInflow 工作台实景" width="440">](workbenches/70-geoinflow/) |
| **[OpenPencil · 全幅组件画板、图层与属性工具](workbenches/71-openpencil/)**<br>[<img src="docs/screenshots/openpencil.png" alt="OpenPencil 工作台实景" width="440">](workbenches/71-openpencil/) | **[FigCraft · 暗色原型校样、画板序列与文案复核](workbenches/72-figcraft/)**<br>[<img src="docs/screenshots/figcraft.png" alt="FigCraft 工作台实景" width="440">](workbenches/72-figcraft/) |

自动保存区分待保存、同步中、已保存、待完善草稿、离线和版本冲突。后台保存时仍可编辑；项目导入创建独立项目，未完成输入可恢复。浏览器本机缓存限定同一来源。

## 开发

需要 Node 22.16+（22.x）、pnpm 10.22.0 和 Git。

```sh
pnpm workbench list
pnpm workbench prepare excalidraw
pnpm workbench check excalidraw
pnpm workbench test excalidraw
pnpm workbench dev excalidraw
pnpm workbench package excalidraw

# 批量验证并打包所有已验收项目
pnpm batch check
pnpm batch test
pnpm batch package
pnpm test:tooling
```

准备命令从官方仓库获取 `template.lock.json` 固定版本的工具链，并安装锁定依赖。SDK、编译器、缓存和本地数据不提交到此仓库。业务代码保存在对应工作台的 `app/` 中。

每个应用独立维护 manifest、依赖锁、SQLite 迁移、测试及验收记录。启动预览后使用终端打印的完整地址。生成的 `.fbworkbench` 位于该项目的 `artifacts/`，可通过 Floatboat 的「我的 → 工作台 → 导入工作台」导入。

继续实现计划项目时运行 `node scripts/init-workbench.mjs <slug>`；缺少模板缓存会自动获取锁定版本，已存在的应用及身份不会被覆盖。然后按 `AGENTS.md` 补齐设计、业务代码和验收。批量命令与日志位置见 [开发说明](docs/batch-commands.md)。

## 许可

上游项目、商业扩展和模板 SDK 的许可分别适用。参考各工作台 README、`notices/` 与 `docs/licensing.md`。本仓库尚未选择覆盖所有项目的统一开源许可证。
