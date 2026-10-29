# 工作台可用性与深度审计 · 2026-10-29

用户反馈：工作台缺乏深度，部分可能无法使用。基线 `7a0e4ee`，覆盖 56 个 `local-verified` 应用。

## 方法

1. `pnpm batch check` / `pnpm batch test`：**56/56 通过**。构建与单元测试不能说明问题。
2. 浏览器冒烟：每个应用在**空数据目录**下启动预览（原 `.local/data` 临时移开并恢复），无头 Chrome 1440 与 375 宽截图，记录控制台/页面错误、失败请求、首个文本框输入后刷新的保存结果。56 个应用全部加载，无页面脚本错误。
3. 逐项审查（8 组并行）：读 README/REQUIREMENTS/DESIGN 与源码，查看截图，必要时实际驱动主流程与导出；“深度缺口”只列**已锁定上游库原生支持**、且用户对这类产品的基本预期。

## 共性问题

| 问题 | 影响项目 |
| --- | --- |
| **首次打开即死路**：核心功能依赖未打包的外部服务，界面只说“未连接”，不给启动方式，且导入的 `.fbworkbench` 永远连不上 | FigCraft、PageIndex、DeepTutor、Agent-Reach（完全不可用）；LangExtract、Promptfoo、DeerFlow、MiroFish、Docling、Graphify、faster-whisper、OpenMontage、Presenton、HyperFrames（核心动作不可用） |
| **校验上限把真实输入挡在门外** | Swagger UI（拒绝绝对 servers、不收 YAML）、glTF（拒绝任何扩展、1.4 MB）、Mermaid（标签含 `image:` 即拒绝）、Bruno（`{{变量}}` 锁死地址栏）、Vega-Lite（必须顶层 mark，组合图全拒）、Filerobot（1 MB）、OSMD（180 KB）、GEOInflow（200 行日志）、Mirador/Mesh2Motion（1 MB） |
| **上游能力只露出一小部分** | Oasis（~130 条命令露出 11 条）、CircuitJS（162 种元件放行 17 种）、pdfme（只注册 text/rectangle）、PptxGenJS（单一版式，无图/表/图表）、Tiptap（6 个按钮，链接已启用但无入口）、Ray Optics（关闭实时光路）、glTF Transform（未安装 functions，不做任何 transform） |
| **示例是玩具** | Swagger（1 个端点）、Observable Plot（5 行）、Vega-Lite（4 根柱）、React Flow（大写一句话）、Tiptap（73 字）、SurveyJS（3 题）、Graphify（5 节点）等；wavesurfer、SeqViz、Agent-Reach、OpenMontage 甚至没有示例 |
| **通用页头组合**（项目选择 + 新建/立即保存在内容之上） | 结构审计已列 26 项 |

## 逐项结论

可用：✅ 可用 · ⚠️ 部分不可用 · ❌ 首次打开不可用。优先级 5 最高。工作量 S ≤1 天。

| ID | 项目 | 可用 | 优先 | 量 | 最关键的问题 |
| --- | --- | --- | --- | --- | --- |
| 72 | FigCraft | ❌ | 5 | M | 引擎是手动下载的 Rust CLI，未打包；首屏“fetch failed”、空舞台。`.figcraft` 为 zip+JSON，可在服务端直接改名称/文字/填充并做近似预览 |
| 64 | PageIndex | ❌ | 5 | M | 无服务时连自带示例 PDF 都打不开（渲染走 Python）；应在浏览器用 pdf.js 阅读 |
| 65 | DeepTutor | ❌ | 5 | S | 核对选择题答案也需要 Python 进程；纯标准库模块可移入 Node；错题无讲解 |
| 66 | Agent-Reach | ❌ | 5 | M | 空目录、无示例、采集按钮禁用；Python 服务只是 GitHub/Jina/V2EX 的薄封装 |
| 09 | Swagger UI | ⚠️ | 5 | M | 真实 OpenAPI 导入失败（绝对 servers、YAML）；仅同源 GET；模型区隐藏；1 个端点 |
| 06 | React Flow | ⚠️ | 5 | L | 4 种操作的直线链，不能分支；无删除键、无配置导入；需要重新定义产品 |
| 78 | glTF Transform | ⚠️ | 5 | M | 拒绝含扩展的 GLB 与 >1.4 MB；没有 prune/dedup/weld/simplify 等任何变换 |
| 05 | PptxGenJS | ✅ | 5 | M | 单一版式，无 addImage/addTable/addChart/addShape，无富文本 |
| 04 | Tiptap | ✅ | 5 | M | 6 个按钮；无链接入口、表格、图片、任务、Markdown；导出 HTML 标题错误 |
| 57 | Docling | ⚠️ | 5 | M-L | 默认无服务；连上也只能转 HTML，不能转 PDF/DOCX；无原页框选对照 |
| 63 | Graphify | ⚠️ | 5 | M | 抽取需手建 Python venv；单文件；社区检测未用；环形布局 |
| 67 | OpenMontage | ⚠️ | 5 | L | 无示例素材，成片需外部服务；只有剪切与硬切拼接 |
| 08 | Mermaid | ⚠️ | 4 | S-M | 含 `image:` 的标签被拒且无法保存；无导入、模板、主题、缩放、PNG |
| 45 | Bruno | ⚠️ | 4 | M | 示例请求指向无服务端口→“回执未知”确认循环；改 URL 后必须先“更新 Bru”；无环境变量/认证 |
| 60 | faster-whisper | ⚠️ | 4 | M | 转写需外部服务且无启动提示；未用 word_timestamps/vad/initial_prompt/translate |
| 56 | LangExtract | ⚠️ | 4 | M | 抽取需 Python 服务与环境变量，无 Host 通道 |
| 61 | Presenton | ⚠️ | 4 | L | 生成依赖自建服务且从未实测，无本地后备 |
| 68 | DeerFlow | ⚠️ | 4 | L | 需完整 DeerFlow 部署且从未实测；只轮询 |
| 03 | pdfme | ✅ | 4 | M | 只有文本/矩形；无表格/图片/条码；不能以现有 PDF 为底；不能按数据行批量生成 |
| 42 | React Email | ✅ | 4 | M | 5 种块，无图片/链接/页脚；不能导出 .tsx |
| 10 | Vega-Lite | ✅ | 4 | M | 拒绝 layer/concat/facet/repeat 与 arc/boxplot；无 CSV；仅 SVG |
| 11 | Observable Plot | ✅ | 4 | M | 3 种 mark、无 bin/group/stack 变换、无颜色/分面；5 行数据 |
| 51 | Maker.js | ✅ | 4 | M | 3 个固定模板；无标准形状组合、布尔运算、阵列、圆角/刀缝 |
| 53 | farmOS-map | ✅ | 4 | M | 主动清空底图，无法描真实地块；只有多边形；测量/吸附行为全关 |
| 73 | Ray Optics | ✅ | 4 | M | 关闭实时光路；只打包 12 类对象，无点光源/棱镜/球面镜 |
| 77 | CircuitJS | ✅ | 4 | M | 162 种元件只放行 17 种；无示例库；原生滑块隐藏 |
| 55 | OSMD | ⚠️ | 4 | M | 180 KB 上限挡住真实乐谱；批注不显示在谱面；无光标 |
| 52 | SeqViz | ✅ | 4 | S | 无示例；无酶切位点/翻译/搜索；不收 GenBank |
| 62 | HyperFrames | ✅ | 4 | L | 每镜头一次淡入；单轨硬切；无图片/视频/音频；固定 720p |
| 76 | Oasis Editor | ✅ | 4 | S-M | 只露出 11/~130 命令；无样式/编号/图片/表格编辑/修订；原生菜单为英文 |
| 44 | Penpot | ✅ | 4 | M | 宣传语+表单而非资产面板；无 token、2 个写死样例 |
| 27 | GrapesJS | ✅ | 4 | S | 无 TraitManager→链接不可改；无图片；单页 |
| 58 | LangGraph | ✅ | 3 | M | 写死 3 节点直线、图不可见；无回溯/流式 |
| 59 | Promptfoo | ⚠️ | 3 | M | 执行器未安装；4 种断言；单 provider |
| 69 | MiroFish | ⚠️ | 3 | L | 需后端+Zep，从未实测；只能启动已准备的模拟 |
| 02 | Markmap | ✅ | 3 | S | 编辑即全部展开；无 KaTeX/复选框/折叠插件；大纲与节点不联动 |
| 07 | SurveyJS | ✅ | 3 | M | 无条件逻辑/多页/矩阵/校验；结果无汇总与 CSV |
| 18 | BlockNote | ✅ | 3 | S | 去掉了代码块/分隔线/图片；页面间无链接 |
| 19 | MDXEditor | ✅ | 3 | M | 审阅意见不锚定文字；无图片/frontmatter/提示块/查找 |
| 21 | PDF.js | ✅ | 3 | M | 搜索不高亮；单页渲染；无目录与链接；批注不写回 PDF |
| 22 | reveal.js | ✅ | 3 | M | 自制 Markdown 子集无图片；无演讲者视图；无代码高亮 |
| 24 | Vditor | ✅ | 3 | S-M | 数学/Mermaid/ECharts/代码高亮渲染全关 |
| 25 | Fabric.js | ✅ | 3 | S | 无图片/线/路径/画笔/渐变；禁止多选与编组 |
| 28 | Konva | ✅ | 3 | S | 无编号标注/画笔/马赛克；无撤销/多选/缩放 |
| 29 | LogicFlow | ✅ | 3 | M | 无撤销与快捷键；无 BPMN；画布仅占 45% |
| 31 | SimpleMindMap | ✅ | 3 | M | 无拖拽改父级；无 PNG/PDF/XMind 导入导出；只开放 3 种结构 |
| 33 | wavesurfer.js | ✅ | 3 | S | 无示例音频；不能拖选区间；无缩略图/频谱/录音 |
| 54 | Mirador | ✅ | 3 | M | 每页独立 manifest，无书本/画廊视图；批注不画在图上 |
| 70 | GEOInflow | ✅ | 3 | M | 200 行日志上限；无平台/时间趋势 |
| 71 | OpenPencil | ✅ | 3 | M | 表单编辑器：画布不能拖拽缩放、无撤销 |
| 01 | Excalidraw | ✅ | 2 | S | 素材库不保存；导出不内嵌场景；无欢迎屏 |
| 20 | Milkdown | ✅ | 2 | S | 图片与公式关闭；KaTeX 字体触发 CSP 报错 |
| 23 | Univer | ✅ | 2 | S-M | 未装排序/筛选/条件格式/数据验证/查找替换预设 |
| 26 | Filerobot | ✅ | 2 | S | 1 MB 上限挡住手机照片；水印页被去掉 |
| 74 | Invoice Builder | ✅ | 2 | S | 无逐行税率、多笔收款、收款码 |
| 75 | Mesh2Motion | ✅ | 2 | M | 只导出单个动作；只有人形骨架 |

## 整改顺序（建议）

1. **先让“打不开/用不了”的能用**（第 1 波）：FigCraft、PageIndex、DeepTutor、Agent-Reach、Swagger UI、Bruno、glTF Transform、Mermaid。原则：能在 Node/浏览器内完成的不再要求外部进程；必须外接的服务在主操作旁给出状态检查与启动方式；放宽到能接住真实文件。
2. **知名库的核心能力补齐**（第 2 波）：PptxGenJS、Tiptap、React Flow、pdfme、CircuitJS、Ray Optics、Oasis、Vega-Lite、Observable Plot、GrapesJS。
3. **服务型 AI 工作台的本地后备与 Host 通道**（第 3 波）：Docling、Graphify、LangExtract、Promptfoo、faster-whisper、OpenMontage、Presenton、DeerFlow、MiroFish。
4. 其余按上表优先级推进；每项同时处理该项的通用页头问题。

功能深度、结构审查与 Host/客户端导入验收继续分开记录。审计证据（脚本、截图、导出文件）保存在本次会话临时目录，不入库。
