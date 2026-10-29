# Floatboat Workbenches

把成熟的 GitHub 项目接入 Floatboat，提供可编辑、自动保存、可导出的业务工作台。

一个项目一个目录。只有完成实际检查的项目才标记为已实现；计划目录不代表已经可用。

## 当前进度

当前版本 **0.9.0**（进行中）· **57 / 79 个工作台已完成本地功能验收**。Floatboat客户端导入尚未实测。

0.9.0 针对“缺乏深度、部分不能使用”做全量整改。[可用性与深度审计](docs/depth-audit-2026-10-29.md)在空数据目录下逐项实际运行全部56项：构建与测试全部通过，但14项核心功能依赖未打包的外部服务、多项校验上限拒绝真实文件、多数只露出上游库很小一部分能力。整改分波推进，进度与验收见[0.9.0 发布记录](docs/release-0.9.0.md)。

第1波已完成8项（首开即可用、接住真实输入、补齐核心能力并重排页面）：Mermaid、Swagger UI、Bruno、PageIndex、DeepTutor、Agent-Reach、FigCraft、glTF Transform。第2波已完成8项（知名库核心能力补齐）：pdfme、Tiptap、PptxGenJS、React Flow、Vega-Lite、Ray Optics、CircuitJS、Oasis Editor。新增 ComfyUI 节点工作流工作台（#79，MIT 客户端，真实生成待用户自有服务验证）。0.8.1结构审计见[结构审计](docs/layout-audit-2026-10-28.md)。

| 项目 | 已实现流程 | 界面方向 |
| --- | --- | --- |
| [Excalidraw](workbenches/01-excalidraw/) | 白板编辑、保存恢复、PNG/SVG/源文件导入导出 | 全幅原生画布 |
| [Markmap](workbenches/02-markmap/) | Markdown 大纲、交互脑图、独立 SVG 导出 | 脑图主屏与可收起大纲 |
| [pdfme](workbenches/03-pdfme/) | 26 种原生字段（表格/图片/条码/日期等）、PDF 底图、原生 Form/Viewer、CSV/JSON 批量合并 PDF 或 ZIP、报价单/面单/证书示例 | 模板菜单、DTP 页面轨与原生设计器 |
| [Tiptap](workbenches/04-tiptap/) | 选区工具条与 / 插入菜单、链接、表格、图片、任务清单、对齐、目录与字数、Markdown/HTML/JSON 导入导出、写作助手 | 窄正文稿纸、章节目录与按需写作助手 |
| [PptxGenJS](workbenches/05-pptxgenjs/) | 10 种母版版式、富文本、图片、表格、原生图表与数据表、形状、舞台拖放吸附与撤销、品牌主题与多比例、PPTX 与项目导出 | 缩略图轨、演示舞台与上下文检查器 |
| [React Flow](workbenches/06-react-flow/) | 20 种确定性节点（CSV/JSON/正则/模板/筛选/分组/关联…）、DAG 执行与节点内预览、调色板拖放、撤销/框选/自动布局、模板库与 JSON 导入导出 | 节点画布、节点调色板与输出检查器 |
| [SurveyJS Form Library](workbenches/07-surveyjs-form-library/) | 问卷设计、填写、答卷保存与导出 | 分阶段表单 |
| [Mermaid](workbenches/08-mermaid/) | 源码 IDE（高亮、逐行错误）、17 类模板、主题/手绘、.mmd/.md 导入、PNG/SVG/剪贴板导出 | 源码 IDE 与可缩放图形预览 |
| [Swagger UI](workbenches/09-swagger-ui/) | YAML/JSON 原文导入导出、并排源码与行号诊断、经代理的全方法试调、内置示例服务 | 端点目录、原生文档与按需源码 |
| [Vega-Lite](workbenches/10-vega-lite/) | 完整 v6 语法与官方 schema 校验、CSV/TSV/JSON 数据窗与字段芯片、CodeMirror 规格编辑、13 个示例、PNG/SVG/项目包导出 | 图表主区、规格检查器与数据窗 |
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
| [OpenSheetMusicDisplay](workbenches/55-opensheetmusicdisplay/) | MusicXML/MXL 原件库、光标与回放、移调与声部切换、谱面批注联动、PDF/PNG/SVG 导出 | 乐谱库、原生谱面与联动批注账本 |
| [LangExtract](workbenches/56-langextract/) | 多文档原文标注、类别与示例配方、区间对齐、审阅统计、JSONL/CSV/可视化 HTML 导出 | 原文纸张与证据账本、档案菜单 |
| [Docling](workbenches/57-docling/) | DoclingDocument结构树、文本/表格校订、顺序、JSON/Markdown/CSV与HTML连接器 | 结构轨、校样纸张与表格检查器 |
| [LangGraph.js](workbenches/58-langgraph/) | Gemini 3.8资料整理、真实StateGraph、人工复核、SQLite检查点与交付导出 | 三站复核流程与运行账本 |
| [Promptfoo](workbenches/59-promptfoo/) | 真实评测结果矩阵、基线、人工复核、限定套件执行器与CSV/JSON导出 | 用例×版本矩阵与结果对照 |
| [faster-whisper](workbenches/60-faster-whisper/) | 示例音频与逐词转写、波形入出点、拆分合并、查找替换、说话人标注、SRT/VTT/TXT/JSON 导出 | 波形时间轴、字幕表与上下文检查器 |
| [Presenton](workbenches/61-presenton/) | 资料导入、大纲编辑、本地幻灯片生成、11 种版式与 5 套主题、原生图表 PPTX 与 PDF 导出 | 资料—大纲—成稿步骤、缩略轨与幻灯片舞台 |
| [Penpot](workbenches/44-penpot/) | 颜色、字体、组件样本与交付说明，原生Penpot归档及CSS导出 | 设计资产样本册与色彩、字体分页 |
| [HyperFrames](workbenches/62-hyperframes/) | 镜头文字与构图、时间线、HyperFrames HTML和真实MP4渲染 | 暗色动效舞台、镜头轨与输出队列 |
| [Graphify](workbenches/63-graphify/) | 真实AST抽取、原生图谱、关系路径、布局与审阅笔记 | 知识地图、符号目录与关系检查器 |
| [PageIndex](workbenches/64-pageindex/) | 浏览器 PDF.js 阅读（无需服务）、章节树、字符级摘录/引用高亮、检索与 Host 原页问答 | 章节目录、PDF 原页与审阅问答 |
| [DeepTutor](workbenches/65-deeptutor/) | 离线判题/排程/题库导入、错题解析与 Host 导师、可控出题与间隔复习 | 对页练习本与题号状态条 |
| [Agent-Reach](workbenches/66-agent-reach/) | 内置 GitHub/网页/搜索/V2EX 采集、首开示例调研、原文摘录高亮、可选 Host 概括与报告 | 来源目录、原文阅读与摘录夹 |
| [OpenMontage](workbenches/67-openmontage/) | 上传原片、入出点、镜头复核、上游组接和MP4交付 | 分镜制作单、原片预览与成片架 |
| [DeerFlow](workbenches/68-deerflow/) | 问题与可确认计划、本地检索、引用联动、来源核验、报告编辑、Markdown/HTML 导出及可选 SSE 研究服务 | 计划、执行、报告阶段与来源证据栏 |
| [MiroFish](workbenches/69-mirofish/) | 已准备模拟的启动/停止、状态核对、原生动作与人工复核 | 角色目录、轮次时间线与动作复核 |
| [GEOInflow](workbenches/70-geoinflow/) | 日志与内容清单、原生UA/引荐分类、覆盖分析和审阅导出 | 宽幅访问账本、范围筛选与逐页调查 |
| [OpenPencil](workbenches/71-openpencil/) | 图层与属性、原生SceneGraph、FIG/SVG及完整项目导出 | 全幅组件画板、图层与属性工具 |
| [FigCraft](workbenches/72-figcraft/) | 无需引擎的近似校样、文案/图层/填色/交付状态写回、SVG/PNG/交付说明导出；原生 PNG/PDF 可选 | 画板胶片、校样舞台与审阅检查器 |
| [Konva](workbenches/28-konva/) | 原生Konva画板、对象变换、图片与PNG/完整工程 | 标注画板、对象工具与图层 |
| [LogicFlow](workbenches/29-logicflow/) | 原生流程图编辑、规则检查、路径审阅与原生数据导出 | 流程图纸、条件连线与结构检查 |
| [SimpleMindMap](workbenches/31-simplemindmap/) | 原生可编辑脑图、结构/主题与导出 | 导图主屏、分支导航与上下文工具 |
| [wavesurfer.js](workbenches/33-wavesurfer-js/) | 真实音频与波形、区间编辑/循环回听、审阅及工程导出 | 波形、时间尺、区间与听审记录 |
| [React Email](workbenches/42-react-email/) | 官方邮件组件编排与渲染、HTML/纯文本/项目导出 | 邮件稿件、收件人变量与多尺寸校样 |
| [Bruno](workbenches/45-bruno/) | 编辑即发送、环境与秘密变量、认证、全部常用请求体、断言与请求历史 | 集合树、请求编辑器与响应控制台 |
| [Ray Optics Simulation](workbenches/73-ray-optics/) | 拖动即实时追迹、上游 5.5.0 全部 42 类对象、光线/像/观察者视图与波长色彩、19 个示例、场景 JSON 往返 | 光路主屏、器材架与实验读数条 |
| [Invoice Builder](workbenches/74-invoice-builder/) | 原生计价与PDF模板、报价/发票、图片及工程恢复 | 明细填写、纸张校样与PDF预览 |
| [Mesh2Motion](workbenches/75-mesh2motion/) | 原生人形绑定、87动作预览、动画GLB与完整工程 | 三维舞台、骨架树、关节参数与动作轨 |
| [Oasis Editor](workbenches/76-oasis-editor/) | 开始/插入/表格/审阅/布局功能区、样式与编号、图片/表格/脚注/公式、修订显示与接受拒绝、批注、页面设置、查找替换、中文原生菜单、DOCX/PDF 导出与重新打开 | 居中纸张、功能区与审阅批注 |
| [CircuitJS1](workbenches/77-circuitjs/) | 可搜索元件库（晶体管/555/逻辑/数字芯片…）、366 个官方示例、速度/单步/参数滑块、编辑时持续仿真、原生电路与读数导出 | 电路与示波器、纵向元件架与底部仪表 |
| [glTF Transform](workbenches/78-gltf-transform/) | GLB/glTF/ZIP（Draco/Meshopt/扩展）导入、逐步优化流水线与前后报告、贴图/节点/动画、压缩 GLB 导出 | 模型空间、优化阶段条与浮动检查器 |
| [ComfyUI](workbenches/79-comfyui/) | MIT litegraph 节点画布（213 个核心节点离线可编辑）、UI/API/PNG 工作流导入导出、校验、连接自有 ComfyUI 运行与实时进度、产物图库与可复现记录 | 节点画布、检查器与运行印样带 |

0.4.0批次统一验证：**6项构建、106项应用测试、14项独立服务测试、3项工具测试和6个源码包**通过。真实上游执行包含LangGraph流程恢复、Promptfoo回显评测、Docling HTML转换和faster-whisper英语CPU转写；其他模型/服务条件见发布验收。

[LangGraph 0.4.1](docs/release-0.4.1.md) 默认使用 **Gemini 3.8 Flash**，已通过真实 Host 整理、人工复核、自动保存、交付及刷新恢复；17项应用测试通过，并补齐JSON代码块与日期格式兼容。其他独立AI服务的接入条件保持各项目说明。

既有26项的构建、208项应用测试与源码包记录见[0.3.0验收](docs/release-0.3.0.md)，本批未重跑未修改的既有应用。历史批次：[0.2.0](docs/release-0.2.0.md)、[2–11](docs/batch-02-11.md)。

仓库级 React Best Practices 与 Web Design Guidelines 已安装，入口见 `AGENTS.md`；各产品的设计原则见 [设计说明](docs/design-principles.md)。

新增选题：[Reddit与X的23项调研](docs/research/social-shortlist-2026-10-28.md)；已分两批转化其中6项，其余保持研究状态。

X选题补充：[9个项目与转化优先级](docs/research/x-project-shortlist-2026-10-27.md)（2026-10-27，原帖、GitHub关注度与产品范围分开核验）。

行业补充调研：[28 个小众行业候选](docs/research/niche-industry-candidates.md)。Maker.js、SeqViz、farmOS-map、Mirador 与 OpenSheetMusicDisplay 已实现；其余候选仍处于研究或计划阶段。第12–17项的独立服务接入条件见各自目录。

AI 补充调研：[32 个 AI 项目与工作台选型](docs/research/ai-workbench-candidates.md)。覆盖文档抽取、知识图谱、Agent、评测、字幕、配音、课件和视觉生成，另含 3 个通用组件；已列明接口、独立服务、模型许可和维护边界。该次首批完成6项；后续转化状态以当前清单为准，正式模型/外部服务范围以各项目说明为准。

第3波10项正在收尾：OpenSheetMusicDisplay、LangExtract、faster-whisper、Presenton、DeerFlow已完成本地验收；其余5项待最终验包与提交。第4–6波30项待开展。详细范围、验证与限制见[第三波记录](docs/release-0.9.0.md#第3波--本地工作流与可选服务)。

## 工作台实景

以下为 57 个已验收本地工作台的真实 Chrome 界面，使用普通示例资料。点击预览进入项目说明；图片未经过界面合成或像素修饰。采集版本、原始尺寸与哈希见 [截图说明](docs/screenshots/README.md)。

| | |
| --- | --- |
| **[Excalidraw · 白板](workbenches/01-excalidraw/)**<br>[<img src="docs/screenshots/excalidraw.png" alt="Excalidraw · 白板工作台实景" width="440">](workbenches/01-excalidraw/) | **[Markmap · 脑图](workbenches/02-markmap/)**<br>[<img src="docs/screenshots/markmap.png" alt="Markmap · 脑图工作台实景" width="440">](workbenches/02-markmap/) |
| **[pdfme · 模板菜单、DTP 页面轨与原生设计器](workbenches/03-pdfme/)**<br>[<img src="docs/screenshots/pdfme.png" alt="pdfme · 排版台工作台实景" width="440">](workbenches/03-pdfme/) | **[Tiptap · 窄正文稿纸、章节目录与按需写作助手](workbenches/04-tiptap/)**<br>[<img src="docs/screenshots/tiptap.png" alt="Tiptap · 写作工作台实景" width="440">](workbenches/04-tiptap/) |
| **[PptxGenJS · 缩略图轨、演示舞台与上下文检查器](workbenches/05-pptxgenjs/)**<br>[<img src="docs/screenshots/pptxgenjs.png" alt="PptxGenJS · 演示工作台实景" width="440">](workbenches/05-pptxgenjs/) | **[React Flow · 节点画布、节点调色板与输出检查器](workbenches/06-react-flow/)**<br>[<img src="docs/screenshots/react-flow.png" alt="React Flow · 工作流工作台实景" width="440">](workbenches/06-react-flow/) |
| **[SurveyJS Form Library · 问卷](workbenches/07-surveyjs-form-library/)**<br>[<img src="docs/screenshots/surveyjs.png" alt="SurveyJS Form Library · 问卷工作台实景" width="440">](workbenches/07-surveyjs-form-library/) | **[Mermaid · 源码 IDE 与可缩放图形预览](workbenches/08-mermaid/)**<br>[<img src="docs/screenshots/mermaid.png" alt="Mermaid · 图解工作台实景" width="440">](workbenches/08-mermaid/) |
| **[Swagger UI · 端点目录、原生文档与按需源码](workbenches/09-swagger-ui/)**<br>[<img src="docs/screenshots/swagger-ui.png" alt="Swagger UI · API 文档工作台实景" width="440">](workbenches/09-swagger-ui/) | **[Vega-Lite · 图表主区、规格检查器与数据窗](workbenches/10-vega-lite/)**<br>[<img src="docs/screenshots/vega-lite.png" alt="Vega-Lite · 图表规格工作台实景" width="440">](workbenches/10-vega-lite/) |
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
| **[Graphify · 知识地图、符号目录与关系检查器](workbenches/63-graphify/)**<br>[<img src="docs/screenshots/graphify.png" alt="Graphify 工作台实景" width="440">](workbenches/63-graphify/) | **[PageIndex · 章节目录、PDF 原页与审阅问答](workbenches/64-pageindex/)**<br>[<img src="docs/screenshots/pageindex.png" alt="PageIndex 工作台实景" width="440">](workbenches/64-pageindex/) |
| **[DeepTutor · 对页练习本与题号状态条](workbenches/65-deeptutor/)**<br>[<img src="docs/screenshots/deeptutor.png" alt="DeepTutor 工作台实景" width="440">](workbenches/65-deeptutor/) | **[Agent-Reach · 来源目录、原文阅读与摘录夹](workbenches/66-agent-reach/)**<br>[<img src="docs/screenshots/agent-reach.png" alt="Agent-Reach 工作台实景" width="440">](workbenches/66-agent-reach/) |
| **[OpenMontage · 分镜制作单、原片预览与成片架](workbenches/67-openmontage/)**<br>[<img src="docs/screenshots/openmontage.png" alt="OpenMontage 工作台实景" width="440">](workbenches/67-openmontage/) | **[DeerFlow · 研究进度、交付纸张与来源证据页](workbenches/68-deerflow/)**<br>[<img src="docs/screenshots/deerflow.png" alt="DeerFlow 工作台实景" width="440">](workbenches/68-deerflow/) |
| **[MiroFish · 角色目录、轮次时间线与动作复核](workbenches/69-mirofish/)**<br>[<img src="docs/screenshots/mirofish.png" alt="MiroFish 工作台实景" width="440">](workbenches/69-mirofish/) | **[GEOInflow · 宽幅访问账本、范围筛选与逐页调查](workbenches/70-geoinflow/)**<br>[<img src="docs/screenshots/geoinflow.png" alt="GEOInflow 工作台实景" width="440">](workbenches/70-geoinflow/) |
| **[OpenPencil · 全幅组件画板、图层与属性工具](workbenches/71-openpencil/)**<br>[<img src="docs/screenshots/openpencil.png" alt="OpenPencil 工作台实景" width="440">](workbenches/71-openpencil/) | **[FigCraft · 画板胶片、校样舞台与审阅检查器](workbenches/72-figcraft/)**<br>[<img src="docs/screenshots/figcraft.png" alt="FigCraft 工作台实景" width="440">](workbenches/72-figcraft/) |
| **[Konva · 标注画板、对象工具与图层](workbenches/28-konva/)**<br>[<img src="docs/screenshots/konva.png" alt="Konva 工作台实景" width="440">](workbenches/28-konva/) | **[LogicFlow · 流程图纸、条件连线与结构检查](workbenches/29-logicflow/)**<br>[<img src="docs/screenshots/logicflow.png" alt="LogicFlow 工作台实景" width="440">](workbenches/29-logicflow/) |
| **[SimpleMindMap · 导图主屏、分支导航与上下文工具](workbenches/31-simplemindmap/)**<br>[<img src="docs/screenshots/simplemindmap.png" alt="SimpleMindMap 工作台实景" width="440">](workbenches/31-simplemindmap/) | **[wavesurfer.js · 波形、时间尺、区间与听审记录](workbenches/33-wavesurfer-js/)**<br>[<img src="docs/screenshots/wavesurfer-js.png" alt="wavesurfer.js 工作台实景" width="440">](workbenches/33-wavesurfer-js/) |
| **[React Email · 邮件稿件、收件人变量与多尺寸校样](workbenches/42-react-email/)**<br>[<img src="docs/screenshots/react-email.png" alt="React Email 工作台实景" width="440">](workbenches/42-react-email/) | **[Bruno · 集合树、请求编辑器与响应控制台](workbenches/45-bruno/)**<br>[<img src="docs/screenshots/bruno.png" alt="Bruno 工作台实景" width="440">](workbenches/45-bruno/) |
| **[Ray Optics Simulation · 光路主屏、器材架与实验读数条](workbenches/73-ray-optics/)**<br>[<img src="docs/screenshots/ray-optics.png" alt="Ray Optics Simulation 工作台实景" width="440">](workbenches/73-ray-optics/) | **[Invoice Builder · 明细填写、纸张校样与PDF预览](workbenches/74-invoice-builder/)**<br>[<img src="docs/screenshots/invoice-builder.png" alt="Invoice Builder 工作台实景" width="440">](workbenches/74-invoice-builder/) |
| **[Mesh2Motion · 三维舞台、骨架树、关节参数与动作轨](workbenches/75-mesh2motion/)**<br>[<img src="docs/screenshots/mesh2motion.png" alt="Mesh2Motion 工作台实景" width="440">](workbenches/75-mesh2motion/) |  |
| **[Oasis Editor · 居中纸张、功能区与审阅批注](workbenches/76-oasis-editor/)**<br>[<img src="docs/screenshots/oasis-editor.png" alt="Oasis Editor 工作台实景" width="440">](workbenches/76-oasis-editor/) | **[CircuitJS1 · 电路与示波器、纵向元件架与底部仪表](workbenches/77-circuitjs/)**<br>[<img src="docs/screenshots/circuitjs.png" alt="CircuitJS1 工作台实景" width="440">](workbenches/77-circuitjs/) |
| **[glTF Transform · 模型空间、优化阶段条与浮动检查器](workbenches/78-gltf-transform/)**<br>[<img src="docs/screenshots/gltf-transform.png" alt="glTF Transform 工作台实景" width="440">](workbenches/78-gltf-transform/) | **[ComfyUI · 节点画布、检查器与运行印样带](workbenches/79-comfyui/)**<br>[<img src="docs/screenshots/comfyui.png" alt="ComfyUI 工作台实景（模拟服务输出）" width="440">](workbenches/79-comfyui/) |

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

GitHub CI 会自动检查、测试并打包全部已验收工作台，产物同时包含真实介绍截图和 `presentation.json`。在 Actions 中下载对应 `workbench-<slug>`；配置官方账号后可自动上传后端。触发方式、配置及介绍图协议见[自动打包与官方上传](docs/ci-packages.md)。

继续实现计划项目时运行 `node scripts/init-workbench.mjs <slug>`；缺少模板缓存会自动获取锁定版本，已存在的应用及身份不会被覆盖。然后按 `AGENTS.md` 补齐设计、业务代码和验收。批量命令与日志位置见 [开发说明](docs/batch-commands.md)。

## 许可

57个已验收工作台中，56个应用的原创集成与封装代码采用 MIT；CircuitJS 衍生工作台整体采用 GPL-2.0-or-later，完整对应源码与重建说明随包交付。范围及完整文本见各应用的 `app/LICENSE`。第三方源码、资源、字体、依赖、商业扩展和模板 SDK 保留各自许可；这不是覆盖整个仓库或候选项目清单的统一 MIT 授权。参考各工作台 README、`notices/` 与[许可边界](docs/licensing.md)。
