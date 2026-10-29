# 0.9.0 · 让工作台能用、有深度

用户反馈：工作台缺乏深度，部分可能不能使用。[审计](depth-audit-2026-10-29.md)确认：56项构建与测试全部通过，但在空数据目录下实际运行时，14项核心功能依赖未打包的外部服务，多项校验上限拒绝真实文件，多数只露出上游库很小一部分能力，示例接近玩具。0.9.0 分波整改，每项在隔离 worktree 内完成实现、测试、真实浏览器验收与打包，再由主线复核合入。

每项共同验收标准：

1. 空数据、无外部服务、无 Floatboat Host 时，新用户可从首屏完成主任务并得到真实文件；必须外接的能力在主操作旁给出状态、启动方式与重新检查，不再出现原始“fetch failed”。
2. 接住真实输入：去除拒绝普通真实文件的白名单和过小上限。
3. 用已锁定的上游 API 补齐该产品的核心能力，并提供普通、可信的示例资料。
4. 去掉通用页头组合，原生工作对象主导；文件生命周期进入产品自己的文件菜单或资料库。
5. 自动保存契约回归：延迟保存期间继续输入、丢失响应幂等重试、无效草稿恢复、导入新建文档。

功能验收与结构审查分开记录。本轮结构改动均有真实截图；与相邻工作台的正式对照审查仍为待定。Floatboat 客户端导入均未实测。

## 第1波 · 首次打开即不可用或部分不可用的8项

| 工作台 | 之前 | 现在 | 测试 | 真实 Host |
| --- | --- | --- | --- | --- |
| DeepTutor | 核对选择题答案也需要单独的 Python 进程 | 判题、间隔复习、题库导入移入 Node（与原 Python 输出逐项一致）；错题解析与 Host 导师追问；可控出题；12 题示例 | 55 | gemini-3.8-flash |
| FigCraft | 引擎为手动下载的 Rust CLI，首屏 fetch failed、空舞台 | 服务端直接读写 `.figcraft`；近似校样渲染 4 屏 224 节点；文案/名称/填色/交付状态写回；SVG/PNG/交付说明；原生 PNG/PDF 可选 | 14 | 不使用 |
| Bruno | 示例请求必然失败并陷入“回执未知”确认；改 URL 后须先更新源文件；`{{变量}}` 锁死地址栏 | 编辑即发送、Bru 双向同步；环境与秘密变量；认证；全部常用请求体；断言；请求历史；本机回声示例首开 200 | 23 | 不使用 |
| Agent-Reach | 空目录、无示例、采集按钮禁用 | 采集移入 Node（GitHub、网页阅读/直读、网页搜索、V2EX，含 SSRF 防护与代理）；真实示例调研；原文摘录高亮；可选 Host 概括 | 34 | gemini-2.5-flash-lite |
| Swagger UI | 拒绝绝对 servers 与 YAML，真实规格无法导入；仅同源 GET；1 个端点 | OAS 3.x/Swagger 2.0 YAML/JSON 原文保存；并排源码与行号诊断；经代理全方法试调（默认阻止内网）；12 端点示例服务 | 26 | 未重测 |
| Mermaid | 标签含 `image:` 被拒且无法保存；无导入 | 仅拦截真实外部资源；CodeMirror 高亮与逐行错误；17 类模板；主题/手绘；`.mmd/.md` 导入；缩放平移；PNG/SVG/剪贴板 | 14 | 一次真实调用 |
| glTF Transform | 拒绝任何扩展与 >1.4 MB；未做任何 transform | GLB/glTF/ZIP、Draco/Meshopt/扩展，64 MB；分片上传；prune/dedup/weld/simplify 等逐步流水线、撤销与前后报告；贴图、节点、动画；压缩 GLB 导出 | 22 | 不使用 |
| PageIndex | 无服务时连自带示例 PDF 都打不开 | 浏览器 PDF.js 阅读；书签/标题章节树；字符级摘录与引用高亮；检索；Host 原页问答；PageIndex 章节树服务可选 | 21 | gemini-3.8-flash |

每项的验收细节、浏览器流程、导出文件校验与剩余限制见各目录 `ACCEPTANCE.md`。

### 改版对照

左侧为审计基线 `7a0e4ee` 的历史截图，右侧为 0.9.0 真实运行截图。

| 工作台 | 改版前 | 0.9.0 |
| --- | --- | --- |
| DeepTutor | <img src="https://raw.githubusercontent.com/floatboatai/floatboat-workbenches/7a0e4ee6f2d0c22bc3bc70ee53fc4cc9115ab5ac/docs/screenshots/deeptutor.png" alt="DeepTutor 改版前" width="360"> | <img src="screenshots/deeptutor.png" alt="DeepTutor 0.9.0" width="360"> |
| FigCraft | <img src="https://raw.githubusercontent.com/floatboatai/floatboat-workbenches/7a0e4ee6f2d0c22bc3bc70ee53fc4cc9115ab5ac/docs/screenshots/figcraft.png" alt="FigCraft 改版前" width="360"> | <img src="screenshots/figcraft.png" alt="FigCraft 0.9.0" width="360"> |
| Bruno | <img src="https://raw.githubusercontent.com/floatboatai/floatboat-workbenches/7a0e4ee6f2d0c22bc3bc70ee53fc4cc9115ab5ac/docs/screenshots/bruno.png" alt="Bruno 改版前" width="360"> | <img src="screenshots/bruno.png" alt="Bruno 0.9.0" width="360"> |
| Agent-Reach | <img src="https://raw.githubusercontent.com/floatboatai/floatboat-workbenches/7a0e4ee6f2d0c22bc3bc70ee53fc4cc9115ab5ac/docs/screenshots/agent-reach.png" alt="Agent-Reach 改版前" width="360"> | <img src="screenshots/agent-reach.png" alt="Agent-Reach 0.9.0" width="360"> |
| Swagger UI | <img src="https://raw.githubusercontent.com/floatboatai/floatboat-workbenches/7a0e4ee6f2d0c22bc3bc70ee53fc4cc9115ab5ac/docs/screenshots/swagger-ui.png" alt="Swagger UI 改版前" width="360"> | <img src="screenshots/swagger-ui.png" alt="Swagger UI 0.9.0" width="360"> |
| Mermaid | <img src="https://raw.githubusercontent.com/floatboatai/floatboat-workbenches/7a0e4ee6f2d0c22bc3bc70ee53fc4cc9115ab5ac/docs/screenshots/mermaid.png" alt="Mermaid 改版前" width="360"> | <img src="screenshots/mermaid.png" alt="Mermaid 0.9.0" width="360"> |
| glTF Transform | <img src="https://raw.githubusercontent.com/floatboatai/floatboat-workbenches/7a0e4ee6f2d0c22bc3bc70ee53fc4cc9115ab5ac/docs/screenshots/gltf-transform.png" alt="glTF Transform 改版前" width="360"> | <img src="screenshots/gltf-transform.png" alt="glTF Transform 0.9.0" width="360"> |
| PageIndex | <img src="https://raw.githubusercontent.com/floatboatai/floatboat-workbenches/7a0e4ee6f2d0c22bc3bc70ee53fc4cc9115ab5ac/docs/screenshots/pageindex.png" alt="PageIndex 改版前" width="360"> | <img src="screenshots/pageindex.png" alt="PageIndex 0.9.0" width="360"> |

### 主线复核

合入前逐项复核：分支只改动本项目目录与对应截图；在其 worktree 重跑 `check` 与 `test` 全部通过；查看真实截图。各项 `package` 由实现者运行并记录产物哈希。

已知的共性问题：两项实现者独立报告共享 `autosave-client.ts` 在成功保存后切换文档可能误弹“本机缓存尚未修复”确认。该问题在蓝图中统一修复后同步到所有应用，结果另行记录。

### 共享自动保存修复

根因：成功保存后 `edited` 标记要等下一次渲染后的本机缓存修复才清除；用户在防抖保存前或恢复的待同步结果重放后立即切换文档时，`leave()` 先完成保存再检查标记，于是误报“本机缓存尚未修复”。现在保存回执与 IndexedDB 写入都确认后立即视为已同步；缓存写入失败、更新的编辑、冲突与未知回执仍然提示。蓝图新增 7 项回归测试；55 个应用替换为新客户端，Oasis 的定制副本手工应用同一修改。全部 56 项升一个补丁版本后重新打包。

## 第2波 · 知名库核心能力补齐

| 工作台 | 之前 | 现在 | 测试 |
| --- | --- | --- | --- |
| pdfme | 只注册文本与矩形；不能用现有 PDF 作底；不能按数据行批量生成；填写为仿制 HTML | 26 种原生字段（表格、图片、条码、日期、复选、选择、SVG…）；PDF 底图（40 MB/100 页）；原生 Form/Viewer；CSV（含 GBK）/JSON 批量合并 PDF 或 ZIP；报价单、面单、证书示例 | 55 |
| Tiptap | 6 个按钮，链接已启用却无入口；无表格、图片、任务、Markdown | 选区工具条与 / 插入菜单、链接、表格（合并/列宽）、图片（压缩为 WebP 存入文稿）、任务清单、对齐、目录与字数；Markdown/HTML/JSON 导入导出 | 23 |
| PptxGenJS | 单一版式，无图片/表格/图表 | 10 种母版版式、富文本、图片、表格、原生图表与数据表、形状；舞台拖放、吸附、撤销；品牌主题与 16:9/16:10/4:3；修正 PptxGenJS 生成的多余 `a:pPr` | 20 |
| React Flow | 4 种操作的直线链，把一句话转大写 | 本地数据流水线：20 种确定性节点、类型端口、分支与合并、节点内预览、正则超时保护；调色板拖放、框选、撤销、自动布局；5 个模板 | 25 |
| Vega-Lite | 必须顶层 mark，拒绝 layer/concat/facet/repeat；仅内嵌数据 | 完整 v6 语法与官方 schema 校验；CSV/TSV/JSON 数据窗（20 MiB）与字段芯片；CodeMirror 补全与悬停说明；13 个示例；PNG/SVG/项目包 | 20 |
| Ray Optics | 关闭实时光路；只有 12 类对象 | 拖动即实时追迹（按质量设上限）；上游 5.5.0 全部 42 类对象；四种视图与波长色彩；19 个示例 | 14 |
| Oasis Editor | 约 130 条命令只露出 11 条；原生菜单为英文；示例为重复填充文字；包内缺少 LICENSE 导致商店拒收 | 开始/插入/表格/审阅/布局功能区；修订在纸面显示并可逐条接受拒绝，批注面板；中文原生菜单与断行；修复引擎中修订丢失、脚注崩溃、导出后无法重新打开等 9 处问题；3 页中文项目建议书示例；补齐 `app/LICENSE` | 23 |
| CircuitJS | 162 种元件放行 17 种；无示例库；编辑即暂停 | 141 种可搜索元件（仅排除读取本地文件或无法交付的 3 种并写明原因）；366 个官方示例；速度、单步与参数滑块；编辑时持续仿真；首屏 555 闪光电路 | 16 |

合并后在主线重新安装依赖并逐项运行 `check` 与 `test`，全部通过。CircuitJS 与 Oasis Editor 保留 0.8.1 已通过的结构；其余结构审查仍为待定。

| 工作台 | 改版前 | 0.9.0 |
| --- | --- | --- |
| pdfme | <img src="https://raw.githubusercontent.com/floatboatai/floatboat-workbenches/7a0e4ee6f2d0c22bc3bc70ee53fc4cc9115ab5ac/docs/screenshots/pdfme.png" alt="pdfme 改版前" width="360"> | <img src="screenshots/pdfme.png" alt="pdfme 0.9.0" width="360"> |
| Tiptap | <img src="https://raw.githubusercontent.com/floatboatai/floatboat-workbenches/7a0e4ee6f2d0c22bc3bc70ee53fc4cc9115ab5ac/docs/screenshots/tiptap.png" alt="Tiptap 改版前" width="360"> | <img src="screenshots/tiptap.png" alt="Tiptap 0.9.0" width="360"> |
| PptxGenJS | <img src="https://raw.githubusercontent.com/floatboatai/floatboat-workbenches/7a0e4ee6f2d0c22bc3bc70ee53fc4cc9115ab5ac/docs/screenshots/pptxgenjs.png" alt="PptxGenJS 改版前" width="360"> | <img src="screenshots/pptxgenjs.png" alt="PptxGenJS 0.9.0" width="360"> |
| React Flow | <img src="https://raw.githubusercontent.com/floatboatai/floatboat-workbenches/7a0e4ee6f2d0c22bc3bc70ee53fc4cc9115ab5ac/docs/screenshots/react-flow.png" alt="React Flow 改版前" width="360"> | <img src="screenshots/react-flow.png" alt="React Flow 0.9.0" width="360"> |
| Vega-Lite | <img src="https://raw.githubusercontent.com/floatboatai/floatboat-workbenches/7a0e4ee6f2d0c22bc3bc70ee53fc4cc9115ab5ac/docs/screenshots/vega-lite.png" alt="Vega-Lite 改版前" width="360"> | <img src="screenshots/vega-lite.png" alt="Vega-Lite 0.9.0" width="360"> |
| Ray Optics | <img src="https://raw.githubusercontent.com/floatboatai/floatboat-workbenches/7a0e4ee6f2d0c22bc3bc70ee53fc4cc9115ab5ac/docs/screenshots/ray-optics.png" alt="Ray Optics 改版前" width="360"> | <img src="screenshots/ray-optics.png" alt="Ray Optics 0.9.0" width="360"> |
| Oasis Editor | <img src="https://raw.githubusercontent.com/floatboatai/floatboat-workbenches/7a0e4ee6f2d0c22bc3bc70ee53fc4cc9115ab5ac/docs/screenshots/oasis-editor.png" alt="Oasis Editor 改版前" width="360"> | <img src="screenshots/oasis-editor.png" alt="Oasis Editor 0.9.0" width="360"> |
| CircuitJS | <img src="https://raw.githubusercontent.com/floatboatai/floatboat-workbenches/7a0e4ee6f2d0c22bc3bc70ee53fc4cc9115ab5ac/docs/screenshots/circuitjs.png" alt="CircuitJS 改版前" width="360"> | <img src="screenshots/circuitjs.png" alt="CircuitJS 0.9.0" width="360"> |

## 第3波 · 本地工作流与可选服务

第3波10项已完成本地功能验收与打包，纳入本地整合分支。第4–6波的30项尚未开展。本地验收与商店上架、客户端导入分别记录。

| 工作台 | 0.9.0 能力 | 应用测试 | 验收记录 |
| --- | --- | ---: | --- |
| OpenSheetMusicDisplay | MusicXML/MXL 原件库、光标与回放、移调与声部切换、谱面批注联动、PDF/PNG/SVG 导出 | 17 | [验收](../workbenches/55-opensheetmusicdisplay/app/ACCEPTANCE.md) |
| LangExtract | 多文档原文标注、类别与示例配方、区间对齐、审阅统计、JSONL/CSV/可视化 HTML 导出 | 34 | [验收](../workbenches/56-langextract/ACCEPTANCE.md) |
| Docling | 本地 PDF/DOCX/HTML/Markdown 转换、原页与结构块框选、文本表格校订、Docling JSON/Markdown/HTML/CSV 导出 | 35 | [验收](../workbenches/57-docling/app/ACCEPTANCE.md) |
| Promptfoo | 用例×提示版本×provider 评测矩阵、本机回放与脚本、常用断言、运行对比、发布判断、配置和结果导入导出 | 25 | [验收](../workbenches/59-promptfoo/app/ACCEPTANCE.md) |
| faster-whisper | 示例音频与逐词转写、波形入出点、拆分合并、查找替换、说话人标注、SRT/VTT/TXT/JSON 导出 | 30 | [验收](../workbenches/60-faster-whisper/ACCEPTANCE.md) |
| Presenton | 资料导入、大纲编辑、本地幻灯片生成、11 种版式与 5 套主题、原生图表 PPTX 与 PDF 导出 | 49 | [验收](../workbenches/61-presenton/app/ACCEPTANCE.md) |
| Graphify | 多文件与文件夹知识抽取、Louvain 社区、力导向图、原文定位、搜索路径、GraphML/交互 HTML/完整项目导出 | 26 | [验收](../workbenches/63-graphify/app/ACCEPTANCE.md) |
| OpenMontage | 多轨视频图片音频字幕、移动修剪分割、转场混音、浏览器 MP4/WebM 成片与完整工程导出 | 25 | [验收](../workbenches/67-openmontage/app/ACCEPTANCE.md) |
| DeerFlow | 问题与可确认计划、本地检索、引用联动、来源核验、报告编辑、Markdown/HTML 导出及可选 SSE 研究服务 | 53 | [验收](../workbenches/68-deerflow/ACCEPTANCE.md) |
| MiroFish | 资料与实体图谱、人设编辑、可复现规则推演、事件注入、立场时间线、报告与完整推演文件导出 | 35 | [验收](../workbenches/69-mirofish/app/ACCEPTANCE.md) |

本轮共 **329 项应用测试**通过，全部已接收项的 check、package 通过。最初五项由整合者独立重跑 check/test；剩余项由接手实现者在各自工作树完成检查与独立浏览器验收。整合按项目逐一比对最终提交，未重复计算解包后重跑或服务测试。

1440/375 浏览器主流程、自动保存和失败处理详见逐项记录。最初五项的浏览器运行来自本日原验收记录，整合者复核最终截图，未将历史运行记为本次重跑；后五项进行了本次独立浏览器验收。Docling、Graphify 另在解包副本运行测试。OpenMontage 实际导出桌面与窄屏成片，以 ffprobe 核对编码、尺寸和音轨。功能验收与结构对照分别记录，部分项目的正式跨工作台结构审查仍为 pending。

安装包逐文件核对源码和最终应用文档。OSMD 清理文件尾部空行后重新打包；DeerFlow 原包携带旧版应用说明，已在最终文档完成后重新打包并更新哈希。manifest 资源路径按模板规则规范化。未推送、未合并 main、未发布商店。

真实 Floatboat Host/LLM 未调用，模型通道仅使用 mock；faster-whisper 的 small 中文 CPU 实测沿用本日原验收记录。外部服务范围以逐项验收为准。共享自动保存的约900KB项目上限仍存在；部分大文件通过独立内容库保存，不能把输入上限等同完整项目可保存容量。

## 新增 · ComfyUI（#79）

基于 MIT 的 `@comfyorg/litegraph` 0.17.2 节点画布，经 ComfyUI 官方 HTTP/WebSocket API 连接用户自有服务；工作台为 MIT，不含 ComfyUI 或 ComfyUI_frontend 的 GPL 代码与模型权重。

- 首开离线可用：内置 ComfyUI v0.43.0 的 213 个核心节点接口元数据，可搜索、连线、编辑全部控件类型、分组、静音/绕过、复制粘贴、撤销与校验；连接服务后改用服务端节点定义（含自定义节点），未知节点保留数据。
- 格式：UI 工作流 JSON、API prompt JSON 与 PNG 内嵌工作流导入；UI/API 导出时解析 Reroute/Primitive 并跳过静音/绕过节点；导入总是新建。
- 运行：应用自身服务代理到用户配置的 ComfyUI（无需 `--enable-cors-header`），WebSocket 进度落在执行中的节点上，队列取消/中断，服务端 `node_errors` 映射回节点；令牌默认只在内存。
- 印样带：每次运行保存产物与确切参数，可“载入该次工作流”、2–4 张对比、PNG（含元数据）与 ZIP 下载。模板含 SDXL 文生图、图生图、放大、LoRA、局部重绘与 ControlNet。
- 验收：check、24 项测试、打包通过；7 组浏览器流程针对按官方协议编写的模拟服务（与真实 ComfyUI v0.43.0 CPU 无模型实例核对过消息顺序与错误格式）。**真实生成未验证**；截图中的产物图片来自模拟服务。
- 0.9.1：只补商店介绍。0.9.0 是首次上架，上传时商品尚不存在，介绍图没有写入作者资料，因此发布版本里没有介绍图。0.9.1 上传时商品已存在，介绍图和说明会随新版本一起冻结。应用代码与 0.9.0 相同。

## 发布通道

CI 的上传接口只暂存回执，不进入商店审核。后端 PR [AOE-HQ/aoe-backend#414](https://github.com/AOE-HQ/aoe-backend/pull/414) 新增 `POST /api/workbenches/publish`；已部署并启用 `FLOATBOAT_PUBLISH_ENABLED=true`：2026-10-29 的重跑中 56 个包全部上传，54 个提交为待审核版本，CircuitJS（GPL）按规则跳过，Oasis 因包内缺少 `LICENSE` 被拒，已补齐。说明见[自动打包与官方上传](ci-packages.md#提交商店审核)。
