# 工作台结构审计 · 2026-10-28

用户反馈：工作台仍像同一个产品，尤其反复出现右上角创建项目。此次审查把功能可用、配色差异和工作流结构区分开。

## 基线与发现

基线提交：`b2c90796c4bccb61b38d75200a7a00b64f7a12c8`。对56个`local-verified`应用的入口JSX作源码扫描：40个使用`ProjectPicker`；其中28个在同一个`header`中同时包含项目选择和新建操作。这个规则只识别明确组合，不推断按钮的左右位置，也不把未命中视为设计通过。

另外查看了Mermaid、LangGraph、PageIndex，以及本轮Oasis、CircuitJS、glTF的真实历史截图。重复模式是：品牌/大标题、项目选择、新建/导入/导出占据独立页头，实际工作对象成为其下的内容。颜色、字体和内容区虽有变化，文件生命周期仍照搬同一个模型。

Oasis没有命中页头组合规则，但长期固定的文稿柜、纸张和笔记三栏也需要按写作节奏重新组织。该例说明源码筛选不能代替逐个视觉与任务评审。

## 本轮处理

- Oasis：纸张主体、紧凑文件菜单、按需页导航和笔记。
- CircuitJS：电路画布与示波器主体、元件工具和底部仪表操作、按需实验簿。
- glTF：模型主体、上下文检查工具、按需资产库与交付操作。

以上三项已完成0.8.1结构改版与真实Chrome验收。其他项目保留功能验收状态，结构整改独立记录，不能据此宣称全仓视觉问题已解决。

## 生成与同步边界

`init-workbench.mjs`复制固定官方模板与通用模块，但没有强制布局；反复复用项目选择器和旧页面结构是设计过程的问题。初始化设计说明现在要求先记录主任务、首次使用、工作恢复、空间与对照证据。

`sync-autosave.mjs`原先会覆盖应用的`workspace.tsx`；这使产品自己的导航组件存在被通用模块替换的风险。同步现在保留应用的导航与样式，新增回归验证检查连续升级仍保持自定义UI和已应用迁移。新蓝图不再预置`ProjectPicker`，既有应用的本地组件由各自维护。

## 56项清单

“命中”表示旧版页头同时出现项目选择与新建；“待逐项审查”表示规则未命中，并不等于布局独立。源码链接固定在审计基线，避免后续改版导致定位漂移。

| ID | 产品 | 基线信号 | 结构状态 |
| --- | --- | --- | --- |
| 1 | [Excalidraw](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/01-excalidraw/app/src/ui/App.tsx) | 待逐项审查 | 待视觉与任务审查 |
| 2 | [Markmap](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/02-markmap/app/src/ui/App.tsx) | 待逐项审查 | 待视觉与任务审查 |
| 3 | [pdfme](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/03-pdfme/app/src/ui/App.tsx) | 待逐项审查 | 待视觉与任务审查 |
| 4 | [Tiptap](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/04-tiptap/app/src/ui/App.tsx) | 待逐项审查 | 待视觉与任务审查 |
| 5 | [PptxGenJS](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/05-pptxgenjs/app/src/ui/App.tsx) | 待逐项审查 | 待视觉与任务审查 |
| 6 | [React Flow](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/06-react-flow/app/src/ui/App.tsx) | 待逐项审查 | 待视觉与任务审查 |
| 7 | [SurveyJS Form Library](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/07-surveyjs-form-library/app/src/ui/App.tsx) | 待逐项审查 | 待视觉与任务审查 |
| 8 | [Mermaid](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/08-mermaid/app/src/ui/App.tsx#L41) | 页头组合命中 | 待结构整改 |
| 9 | [Swagger UI](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/09-swagger-ui/app/src/ui/App.tsx#L147) | 页头组合命中 | 待结构整改 |
| 10 | [Vega-Lite](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/10-vega-lite/app/src/ui/App.tsx#L86) | 页头组合命中 | 待结构整改 |
| 11 | [Observable Plot](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/11-observable-plot/app/src/ui/App.tsx#L114) | 页头组合命中 | 待结构整改 |
| 18 | [BlockNote](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/18-blocknote/app/src/ui/App.tsx) | 待逐项审查 | 待视觉与任务审查 |
| 19 | [MDXEditor](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/19-mdxeditor/app/src/ui/App.tsx#L38) | 页头组合命中 | 待结构整改 |
| 20 | [Milkdown](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/20-milkdown/app/src/ui/App.tsx) | 待逐项审查 | 待视觉与任务审查 |
| 21 | [PDF.js](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/21-pdf-js/app/src/ui/App.tsx#L275) | 页头组合命中 | 待结构整改 |
| 22 | [reveal.js](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/22-reveal-js/app/src/ui/App.tsx) | 待逐项审查 | 待视觉与任务审查 |
| 23 | [Univer](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/23-univer/app/src/ui/App.tsx) | 待逐项审查 | 待视觉与任务审查 |
| 24 | [Vditor](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/24-vditor/app/src/ui/App.tsx) | 待逐项审查 | 待视觉与任务审查 |
| 25 | [Fabric.js](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/25-fabric-js/app/src/ui/App.tsx) | 待逐项审查 | 待视觉与任务审查 |
| 26 | [Filerobot Image Editor](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/26-filerobot-image-editor/app/src/ui/App.tsx) | 待逐项审查 | 待视觉与任务审查 |
| 27 | [GrapesJS](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/27-grapesjs/app/src/ui/App.tsx) | 待逐项审查 | 待视觉与任务审查 |
| 28 | [Konva](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/28-konva/app/src/ui/App.tsx) | 待逐项审查 | 待视觉与任务审查 |
| 29 | [LogicFlow](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/29-logicflow/app/src/ui/App.tsx) | 待逐项审查 | 待视觉与任务审查 |
| 31 | [SimpleMindMap](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/31-simplemindmap/app/src/ui/App.tsx) | 待逐项审查 | 待视觉与任务审查 |
| 33 | [wavesurfer.js](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/33-wavesurfer-js/app/src/ui/App.tsx#L203) | 页头组合命中 | 待结构整改 |
| 42 | [React Email](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/42-react-email/app/src/ui/App.tsx#L218) | 页头组合命中 | 待结构整改 |
| 44 | [Penpot](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/44-penpot/app/src/ui/App.tsx#L202) | 页头组合命中 | 待结构整改 |
| 45 | [Bruno](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/45-bruno/app/src/ui/App.tsx) | 待逐项审查 | 待视觉与任务审查 |
| 51 | [Maker.js](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/51-makerjs/app/src/ui/App.tsx) | 待逐项审查 | 待视觉与任务审查 |
| 52 | [SeqViz](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/52-seqviz/app/src/ui/App.tsx) | 待逐项审查 | 待视觉与任务审查 |
| 53 | [farmOS-map](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/53-farmos-map/app/src/ui/App.tsx#L227) | 页头组合命中 | 待结构整改 |
| 54 | [Mirador](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/54-mirador/app/src/ui/App.tsx#L54) | 页头组合命中 | 待结构整改 |
| 55 | [OpenSheetMusicDisplay](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/55-opensheetmusicdisplay/app/src/ui/App.tsx#L160) | 页头组合命中 | 待结构整改 |
| 56 | [LangExtract](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/56-langextract/app/src/ui/App.tsx) | 待逐项审查 | 待视觉与任务审查 |
| 57 | [Docling](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/57-docling/app/src/ui/App.tsx) | 待逐项审查 | 待视觉与任务审查 |
| 58 | [LangGraph.js](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/58-langgraph/app/src/ui/App.tsx#L46) | 页头组合命中 | 待结构整改 |
| 59 | [Promptfoo](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/59-promptfoo/app/src/ui/App.tsx#L379) | 页头组合命中 | 待结构整改 |
| 60 | [faster-whisper](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/60-faster-whisper/app/src/ui/App.tsx#L665) | 页头组合命中 | 待结构整改 |
| 61 | [Presenton](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/61-presenton/app/src/ui/App.tsx) | 待逐项审查 | 待视觉与任务审查 |
| 62 | [HyperFrames](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/62-hyperframes/app/src/ui/App.tsx#L51) | 页头组合命中 | 待结构整改 |
| 63 | [Graphify](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/63-graphify/app/src/ui/App.tsx#L56) | 页头组合命中 | 待结构整改 |
| 64 | [PageIndex](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/64-pageindex/app/src/ui/App.tsx#L84) | 页头组合命中 | 待结构整改 |
| 65 | [DeepTutor](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/65-deeptutor/app/src/ui/App.tsx#L30) | 页头组合命中 | 待结构整改 |
| 66 | [Agent-Reach](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/66-agent-reach/app/src/ui/App.tsx#L47) | 页头组合命中 | 待结构整改 |
| 67 | [OpenMontage](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/67-openmontage/app/src/ui/App.tsx#L114) | 页头组合命中 | 待结构整改 |
| 68 | [DeerFlow](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/68-deerflow/app/src/ui/App.tsx#L448) | 页头组合命中 | 待结构整改 |
| 69 | [MiroFish](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/69-mirofish/app/src/ui/App.tsx#L53) | 页头组合命中 | 待结构整改 |
| 70 | [GEOInflow](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/70-geoinflow/app/src/ui/App.tsx#L46) | 页头组合命中 | 待结构整改 |
| 71 | [OpenPencil](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/71-openpencil/app/src/ui/App.tsx#L241) | 页头组合命中 | 待结构整改 |
| 72 | [FigCraft](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/72-figcraft/app/src/ui/App.tsx#L224) | 页头组合命中 | 待结构整改 |
| 73 | [Ray Optics Simulation](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/73-ray-optics/app/src/ui/App.tsx) | 待逐项审查 | 待视觉与任务审查 |
| 74 | [Invoice Builder](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/74-invoice-builder/app/src/ui/App.tsx) | 待逐项审查 | 待视觉与任务审查 |
| 75 | [Mesh2Motion](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/75-mesh2motion/app/src/ui/App.tsx) | 待逐项审查 | 待视觉与任务审查 |
| 76 | [Oasis Editor](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/76-oasis-editor/app/src/ui/App.tsx) | 待逐项审查 | 本轮已完成0.8.1结构审查 |
| 77 | [CircuitJS1](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/77-circuitjs/app/src/ui/App.tsx#L41) | 页头组合命中 | 本轮已完成0.8.1结构审查 |
| 78 | [glTF Transform](https://github.com/floatboatai/floatboat-workbenches/blob/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/workbenches/78-gltf-transform/app/src/ui/App.tsx#L387) | 页头组合命中 | 本轮已完成0.8.1结构审查 |

本轮结果：3项通过结构审查；26项待结构整改；27项待进一步视觉与任务审查。后两类仍保留原有功能验收结果，不等同于结构通过。
