# Floatboat Workbenches

把成熟的 GitHub 项目接入 Floatboat，提供可编辑、自动保存、可导出的业务工作台。

一个项目一个目录，按 `catalog.json` 的顺序实现。只有完成实际检查的项目才标记为已实现。其余目录仅记录范围，不代表已经可用。

## 当前进度

当前版本 **0.2.0** · **16 / 55 个工作台已完成本地验收**，其余 39 个为计划项目。这里实现的是各上游核心库的工作台集成，具体功能边界以各目录 README 为准。Floatboat 客户端导入流程尚未实测。

| 项目 | 已实现流程 | 界面方向 |
| --- | --- | --- |
| [Excalidraw](workbenches/01-excalidraw/) | 白板编辑、保存恢复、PNG/SVG/源文件导入导出 | 画布 |
| [Markmap](workbenches/02-markmap/) | Markdown 大纲、交互脑图、独立 SVG 导出 | 脑图主屏与可收起大纲 |
| [pdfme](workbenches/03-pdfme/) | 文本/矩形版式设计、中文字段、多页 PDF 导出 | 灰色排版台、页面缩略图与字段栏 |
| [Tiptap](workbenches/04-tiptap/) | 富文本编辑、JSON/HTML 导出 | 专注写作页 |
| [PptxGenJS](workbenches/05-pptxgenjs/) | 幻灯片编排、主题、演讲备注、PPTX 导出 | 黑色演示舞台、缩略图与演讲备注 |
| [React Flow](workbenches/06-react-flow/) | 节点编辑、单链文本变换、实际运行结果 | 节点 IDE、参数检查器与运行控制台 |
| [SurveyJS](workbenches/07-surveyjs-form-library/) | 问卷设计、填写、答卷保存与导出 | 分阶段表单 |
| [Mermaid](workbenches/08-mermaid/) | 源码绘图、错误恢复、源码/SVG 导出 | 源码 IDE 与图形预览 |
| [Swagger UI](workbenches/09-swagger-ui/) | OpenAPI 文档、JSON 编辑、同源 GET 试调 | API 参考台 |
| [Vega-Lite](workbenches/10-vega-lite/) | JSON 图表规格、内嵌数据绘图、SVG 导出 | 规格实验台 |
| [Observable Plot](workbenches/11-observable-plot/) | CSV/JSON 数据、字段映射、三种图表、SVG 导出 | 数据观察室 |
| [Maker.js](workbenches/51-makerjs/) | 参数化零件、尺寸预览、SVG/DXF 导出 | 工程图纸与参数台 |
| [SeqViz](workbenches/52-seqviz/) | 序列导入、注释审阅、环形/线性视图与导出 | 序列审阅与注释轨道 |
| [farmOS-map](workbenches/53-farmos-map/) | 地块绘制、边界调整、分区备注与 GeoJSON 导出 | 地图与地块作业记录 |
| [Mirador](workbenches/54-mirador/) | 本地资料图像、双页对照、逐页复核记录与报告导出 | 文献对照与复核台 |
| [OpenSheetMusicDisplay](workbenches/55-opensheetmusicdisplay/) | MusicXML/MXL 导入、谱面校审、小节批注、SVG/原件/报告导出 | 乐谱纸张与边注 |

0.1.0 的 2–11 批次使用三个独立 worktree 并行实现，再逐项合并。10 项构建、47 项应用测试、3 项公共工具测试和真实浏览器验收通过；详见 [批次验收](docs/batch-02-11.md)。除 pdfme 主流程无需模型外，这一批其余 9 项已完成真实 Host 模型调用。

本次0.2.0的16项构建、114项应用测试、3项公共工具测试和各项目浏览器回归通过，详见 [发布验收](docs/release-0.2.0.md)。

已安装仓库级 React Best Practices 与 Web Design Guidelines，入口见 `AGENTS.md`。各工作台分别制定设计方案，参见 `docs/design-principles.md`。

行业补充调研：[28 个小众行业候选](docs/research/niche-industry-candidates.md)，覆盖制造、农业、文博、实验室、演出与音乐，含 9 个优先原型方向和 2 个维护/迁站观察项。其中 Maker.js、SeqViz、farmOS-map、Mirador 与 OpenSheetMusicDisplay 已转为第 51–55 项；其余候选仍处于研究或计划阶段。源码证据、许可证与接入边界分别记录。

## 工作台实景

以下为 16 个已实现项目的真实 Chrome 界面。点击预览进入项目说明；图片使用示例数据，未实现的 39 个计划项目不展示界面。所有截图均来自当前自动保存版本，未进行图像拼接或修饰。

| | |
| --- | --- |
| **[Excalidraw · 白板](workbenches/01-excalidraw/)**<br>[<img src="docs/screenshots/excalidraw.png" alt="Excalidraw · 白板工作台实景" width="440">](workbenches/01-excalidraw/) | **[Markmap · 脑图](workbenches/02-markmap/)**<br>[<img src="docs/screenshots/markmap.png" alt="Markmap · 脑图工作台实景" width="440">](workbenches/02-markmap/) |
| **[pdfme · 排版台](workbenches/03-pdfme/)**<br>[<img src="docs/screenshots/pdfme.png" alt="pdfme · 排版台工作台实景" width="440">](workbenches/03-pdfme/) | **[Tiptap · 写作](workbenches/04-tiptap/)**<br>[<img src="docs/screenshots/tiptap.png" alt="Tiptap · 写作工作台实景" width="440">](workbenches/04-tiptap/) |
| **[PptxGenJS · 演示](workbenches/05-pptxgenjs/)**<br>[<img src="docs/screenshots/pptxgenjs.png" alt="PptxGenJS · 演示工作台实景" width="440">](workbenches/05-pptxgenjs/) | **[React Flow · 工作流](workbenches/06-react-flow/)**<br>[<img src="docs/screenshots/react-flow.png" alt="React Flow · 工作流工作台实景" width="440">](workbenches/06-react-flow/) |
| **[SurveyJS · 问卷](workbenches/07-surveyjs-form-library/)**<br>[<img src="docs/screenshots/surveyjs.png" alt="SurveyJS · 问卷工作台实景" width="440">](workbenches/07-surveyjs-form-library/) | **[Mermaid · 图解](workbenches/08-mermaid/)**<br>[<img src="docs/screenshots/mermaid.png" alt="Mermaid · 图解工作台实景" width="440">](workbenches/08-mermaid/) |
| **[Swagger UI · API 文档](workbenches/09-swagger-ui/)**<br>[<img src="docs/screenshots/swagger-ui.png" alt="Swagger UI · API 文档工作台实景" width="440">](workbenches/09-swagger-ui/) | **[Vega-Lite · 图表规格](workbenches/10-vega-lite/)**<br>[<img src="docs/screenshots/vega-lite.png" alt="Vega-Lite · 图表规格工作台实景" width="440">](workbenches/10-vega-lite/) |
| **[Observable Plot · 数据](workbenches/11-observable-plot/)**<br>[<img src="docs/screenshots/observable-plot.png" alt="Observable Plot · 数据工作台实景" width="440">](workbenches/11-observable-plot/) | **[Maker.js · 参数制图](workbenches/51-makerjs/)**<br>[<img src="docs/screenshots/makerjs.png" alt="Maker.js · 参数制图工作台实景" width="440">](workbenches/51-makerjs/) |
| **[SeqViz · 序列审阅](workbenches/52-seqviz/)**<br>[<img src="docs/screenshots/seqviz.png" alt="SeqViz · 序列审阅工作台实景" width="440">](workbenches/52-seqviz/) | **[farmOS-map · 地块](workbenches/53-farmos-map/)**<br>[<img src="docs/screenshots/farmos-map.png" alt="farmOS-map · 地块工作台实景" width="440">](workbenches/53-farmos-map/) |
| **[Mirador · 文献对照](workbenches/54-mirador/)**<br>[<img src="docs/screenshots/mirador.png" alt="Mirador · 文献对照工作台实景" width="440">](workbenches/54-mirador/) | **[OSMD · 乐谱校审](workbenches/55-opensheetmusicdisplay/)**<br>[<img src="docs/screenshots/opensheetmusicdisplay.png" alt="OSMD · 乐谱校审工作台实景" width="440">](workbenches/55-opensheetmusicdisplay/) |

自动保存状态区分待保存、同步中、已保存、待完善草稿、离线和版本冲突。编辑器后台保存时保持可编辑；导入创建独立项目，未完成输入可恢复。具体业务边界和导出格式见各项目说明。截图来源记录见 [截图说明](docs/screenshots/README.md)。

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
