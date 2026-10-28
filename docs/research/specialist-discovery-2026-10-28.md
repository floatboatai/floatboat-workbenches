# Reddit 垂直工具候选 · 2026-10-28

本轮补充电子工程、光学、三维资产与遥测方向。下列六项均不在当前 `catalog.json` 的72项中，本轮检索前也未出现在已有 `docs/research/` 笔记里。另附一个没有获得合格社交来源的技术旁支候选。这里只完成资料核验，没有安装运行、通过当前模板CSP验收或完成客户端导入。优先级、布局与接入方案是工程判断。

讨论链接只证明有人发布或使用该项目，不是实时热榜。Reddit票数仅在检索结果明确显示时记录，可能随时间变化；旧帖不当作近期热度。GitHub维护时间来自2026-10-28读取的官方API `pushed_at`，推送不等于发布，也不代表应用质量。

## 建议顺序

| 顺序 | 项目 | 工作台方向 | 当前判断 | 关键前置条件 |
| --- | --- | --- | --- | --- |
| 1 | Ray Optics Simulation | 光学实验与光路讲解台 | 优先做原生引擎探针 / 中 | 先限定CPU模拟、基础元件；公式与WebGPU另验 |
| 2 | CircuitJS1（pfalstad主仓） | 电路实验、示波器与故障讲解台 | 优先探针 / 中–高 | 当前TS实现，按GPL-2.0-or-later分发，原生编辑快照桥接 |
| 3 | glTF Transform | 3D资产交付检查与修整台 | 限定范围优先 / 中 | 普通GLB、core API；压缩codec和贴图处理单列 |
| 4 | KiCanvas | PCB原理图/板图审阅台 | 有条件 / 中 | alpha；选中、视口等嵌入事件不能假定已实现 |
| 5 | Open MCT | 设备测试与遥测回放台 | 先解决版本门槛 / 高 | 当前包要求Node >=24.14.1，模板为Node22 |
| 6 | Wirely | 可视化电路教学实验台 | 等待WASM / 高 | Pyodide、Python核心及GPL-3.0-or-later |

## 1. Ray Optics Simulation：光路实验台

**讨论线索。** [2024-02-15光学软件选型帖](https://www.reddit.com/r/Optics/comments/1arrmps/)中，2025-01-21评论直接推荐 `ricktu288/ray-optics`；[2024-11-02自制AR眼镜帖](https://www.reddit.com/r/raspberry_pi/comments/1gi9b6r/ive_built_a_selfcontained_pair_of_ar_goggles/)的作者也说明用 Ray Optics Simulation 做光线准直设计。这是实际用途线索，不能视作与专业镜头设计软件精度等同。另有[2026-06-11光学沙盒讨论](https://www.reddit.com/r/Optics/comments/1u2zf59/im_an_optics_phd_student_and_i_built_a_free/)提到本项目，但该帖主角是另一个产品，不能把其256票算到Ray Optics头上。

**官方核实。** 项目提供2D几何光学场景、光源、镜面、折射介质、理想透镜与探测器；核心入口分别导出 `Scene`、`Simulator`、`Editor`，场景可序列化JSON，编辑器以事件通知UI，适合保留真实引擎再做工作台。当前还包含CPU和WebGPU引擎；WebGPU标为beta。[README](https://github.com/ricktu288/ray-optics/blob/master/README.md)、[核心入口](https://github.com/ricktu288/ray-optics/blob/master/src/core/index.js)。代码为[Apache-2.0](https://github.com/ricktu288/ray-optics/blob/master/LICENSE)，[官方元数据](https://api.github.com/repos/ricktu288/ray-optics)显示未归档、最近推送2026-10-05。

**建议转换。** 中央全幅光路画布，左侧按光源/镜面/透镜分类的器材抽屉，底部实验测量条，右侧只显示当前元件参数。导入或搭建场景→运行CPU光线追踪→改变折射率/位置→保存实验对照与光路图。固定源码核心，不复制整套Vue站点和Webpack工具链；首版限定基础元件，公式求值、浮点渲染和WebGPU路径分别做CSP/性能探针。[包与构建依赖](https://github.com/ricktu288/ray-optics/blob/master/package.json)。

**自动保存对象。** 原生Scene JSON、未完成参数字符串、选中元件、视口、实验备注及对照条件；原始导入文件保留。刷新恢复为可编辑场景，模拟是否继续运行必须显式处理。首版是二维几何光学教学与解释工具，不宣称波动光学、完整三维镜头优化或制造精度。

## 2. CircuitJS1：电路实验与示波器台

**讨论线索。** [2025-07-06 Big Muff电路帖](https://www.reddit.com/r/diypedals/comments/1lsqlv4/)检索时显示40票，讨论真实音频输入、修改电路并听效果；[2026-08-17教学选型帖](https://www.reddit.com/r/AskElectronics/comments/1vqnt1c/is_it_legal_to_use_voltsim_app_to_similulate/)有人推荐CircuitJS作为可用的自由软件。后一帖涉及他人许可问题，本报告不采纳评论中的法律判断。

**官方核实与版本纠正。** 应核对维护中的 [pfalstad/circuitjs1](https://github.com/pfalstad/circuitjs1)，不能只看2024年后未推送的 `sharpie7/circuitjs1`。当前主仓README已明确网页实现为TypeScript+Vite，不再要求Java/GWT/Eclipse构建；TS核心有 `importCircuitFromText()`、`dumpCircuit(saveState)` 以及JS接口挂钩。[README](https://github.com/pfalstad/circuitjs1/blob/master/README.md)、[CirSim源码](https://github.com/pfalstad/circuitjs1/blob/master/ts/CirSim.ts)。[官方元数据](https://api.github.com/repos/pfalstad/circuitjs1)显示未归档、最近推送2026-10-27。

**许可不能只读package字段。** `ts/package.json`写ISC，但根README和 `ts/CirSim.ts` 文件头都明确 **GPL-2.0-or-later**，根目录提供GPLv2全文；不能因package默认字段就把整个衍生工作台标为MIT/ISC。实现时保留相应源码和归属，明确工作台分发许可。[TS包](https://github.com/pfalstad/circuitjs1/blob/master/ts/package.json)、[COPYING](https://github.com/pfalstad/circuitjs1/blob/master/COPYING.txt)、[源码声明](https://github.com/pfalstad/circuitjs1/blob/master/ts/CirSim.ts)。当前TS包直接运行依赖仅列 `lz-string`；编译工具与模板版本仍需做实际适配，不能把上游Vite配置直接搬入。

**建议转换。** 保留原生电路画布、元件编辑、求解器与波形，新增实验文件柜、参数对照和试验说明。界面采用实验台：上部电路图、下部示波器、侧边元件/参数，不做通用卡片看板。首版下载电路与记录，不连接真实电源、继电器或设备。

**自动保存对象。** 原生电路导出文本/状态、未完成数值输入、探针和示波器配置、参数对照、备注；必须在原生编辑完成前保存工作稿，不能只监听导出动作。恢复不自动启动模拟或音频。精度与支持元件以固定版本为准，不宣称替代专业SPICE验证。

## 3. glTF Transform：三维资产交付检查台

**讨论线索。** [2025-12-16大型GLB数字孪生讨论](https://www.reddit.com/r/threejs/comments/1pnnlm4/handling_huge_gltfglb_models_in_threejs_110m/)检索时显示13票，发帖者用glTF Transform制作实例化模型，并遇到大场景加载和遍历问题；[2023-08-22模型减容讨论](https://www.reddit.com/r/threejs/comments/15y2lnm/)直接链接官方项目。这些是用户场景，不把用户报告的压缩比例当作通用保证。

**官方核实。** SDK支持glTF2.0读取、修改和写回，提供WebIO/NodeIO；`core`、`extensions`、`functions`和CLI分包。当前core包4.5.1直接依赖 `property-graph`；高级处理示例把Draco依赖注册和Node的sharp明确分开。[README](https://github.com/donmccurdy/glTF-Transform/blob/main/README.md)、[core包](https://github.com/donmccurdy/glTF-Transform/blob/main/packages/core/package.json)、[functions包](https://github.com/donmccurdy/glTF-Transform/blob/main/packages/functions/package.json)。[MIT](https://github.com/donmccurdy/glTF-Transform/blob/main/LICENSE.md)；[官方元数据](https://api.github.com/repos/donmccurdy/glTF-Transform)显示未归档、最近推送2026-10-20。

**建议转换。** 普通GLB/glTF+资源→检查节点/材质/纹理/扩展→明确修改名称、材质和资产元数据→导出可再次解析的GLB与检查记录。布局为中央模型、左侧场景树、右侧材质检查、底部资源体积表，强调交付检查。以NodeIO/core保留真实读写，浏览器预览另用真实模型查看器。不能将全套CLI“optimize”当成纯JS无依赖功能；Draco、Meshopt、KTX2、纹理压缩、简化等分别验证WASM或原生依赖，未过关先拒绝相应输入/操作。

**自动保存对象。** 原始模型和贴图资源、变更配方/顺序、未提交字段、检查备注、相机和选中节点；原件与结果分开保存。首版限普通模型，尺寸上限和结果再解析必须实际测试，不能承诺处理数百万面大型场景。

## 4. KiCanvas：PCB审图台

**讨论线索。** [2026-06-30 KiCad浏览器查看器帖子](https://www.reddit.com/r/KiCad/comments/1uk32d1/i_built_a_browserbased_viewer_for_kicad_projects/)讨论了基于KiCanvas的另一产品；社区有人直接建议使用KiCanvas，评论也提醒作者清晰归属。[2024-05-28 Gitea渲染帖](https://www.reddit.com/r/KiCad/comments/1d2ngvh/kicad_renderer_for_gitea/)给出集成实践，2026-05-14仍有使用反馈。不是把其他产品的发布算成KiCanvas本身的新版。

**官方核实。** 纯TypeScript，以Canvas/WebGL查看KiCad原理图与PCB；明确只读、alpha，不是KiCad编辑器。嵌入文档提供 `kicanvas-embed`/`kicanvas-source` 及多文件方式，但deep-link、多个zoom属性和选中/加载等事件仍标未实现或未完整实现。[README](https://github.com/theacodes/kicanvas/blob/main/README.md)、[嵌入API](https://kicanvas.org/embedding/)。主体MIT，附Earcut、Newstroke字形、图标等第三方声明，需保留整份许可通知。[LICENSE.md](https://github.com/theacodes/kicanvas/blob/main/LICENSE.md)。[官方元数据](https://api.github.com/repos/theacodes/kicanvas)显示未归档、最近推送2026-04-28；低频维护和alpha边界都应计入排序。

**建议转换。** 原理图/PCB文件柜→真实渲染和图层审阅→位号关联问题单、交付清单与原件。白色工程图纸与PCB暗色图层两种专用视图；问题列表是附属区。第一关是同源资源和当前源码事件桥接，不能仅根据文档假定选中元件、视口、文件切换事件可靠可用。

**自动保存对象。** 原始KiCad文件、问题单/未完成说明、当前审阅文件；选择/图层/视口持久化只有桥接探针通过才计入完成。可针对一个固定版本新增必要桥接，不能承诺原生修改走线、完整BOM编辑、版本视觉diff或3D板图。建议先测KiCad6/7真实文件，再逐版扩大支持。

## 5. Open MCT：设备测试与遥测回放台

**讨论线索。** [NASA任务控制框架的r/javascript讨论](https://www.reddit.com/r/javascript/comments/m85kw5/nasas_next_generation_mission_control_system_is/)有自称项目成员回答问题，属于2021年的旧线索；本轮正文页面只显示相对时间，未取得可靠的精确日，不作为近期热度。功能事实由NASA官方资料核实。

**官方核实。** Web任务数据可视化框架，可通过Telemetry、Object、Time、Composition等API接入历史数据、对象组织和时轴。[NASA说明](https://nasa.github.io/openmct/about-open-mct/)、[API文档](https://github.com/nasa/openmct/blob/master/API.md)。许可正文明确Apache-2.0，即使GitHub自动分类显示NOASSERTION也不能误判无许可。[LICENSE.md](https://github.com/nasa/openmct/blob/master/LICENSE.md)。[官方元数据](https://api.github.com/repos/nasa/openmct)显示未归档、最近推送2026-10-15。

**前置门槛。** 当前4.3.1的 `package.json` 声明 **Node >=24.14.1**，与现有Node22模板不符。先确定可用的固定浏览器构建/兼容版本与打包策略，不能擅自升级共享模板或强行忽略引擎条件。[package.json](https://github.com/nasa/openmct/blob/master/package.json)。

**建议转换。** 传感器CSV/JSON→字段与时间单位映射→多通道曲线、异常时间段、测试笔记→回放会话和报告。保留Open MCT原生时轴和图表，做测试台式多面板工作区；首版只回放用户导入数据，不控制真实设备。自动保存对象包括原件、映射未完成值、通道/图表布局、时区/单位、时间范围和异常标注。外部实时遥测需要数据服务，不能用示例随机数据冒充接入。

## 6. Wirely：留给WASM就绪后的电路教学台

**讨论线索。** [2026-10-24作者发布帖](https://www.reddit.com/r/foss/comments/1xeahoi/wirely_a_free_opensource_circuit_simulator_draw_a/)检索时149票，后续评论请求Chromebook支持，作者随后给出浏览器版。这是本组最近期的具体社交信号，但票数不能代替引擎验收。

**官方核实。** 原 `richiewillmott/Wirely` 已由官方API重定向至 [wirely-app/wirely-app.github.io](https://github.com/wirely-app/wirely-app.github.io)。README说明原生电路求解、元件编辑、示波器与文件保存；浏览器运行同一Python代码，通过Pyodide完成。桌面端与网页端导出能力不同，网页不能照抄桌面SVG/PDF能力。[README](https://github.com/wirely-app/wirely-app.github.io/blob/main/README.md)。当前1.5.3的项目元数据声明Python>=3.10、PySide6>=6.5、numpy>=1.24及 **GPL-3.0-or-later**，并保留第三方通知。[pyproject.toml](https://github.com/wirely-app/wirely-app.github.io/blob/main/pyproject.toml)、[LICENSE](https://github.com/wirely-app/wirely-app.github.io/blob/main/LICENSE)、[第三方声明](https://github.com/wirely-app/wirely-app.github.io/blob/main/THIRD-PARTY-NOTICES.txt)。[官方元数据](https://api.github.com/repos/wirely-app/wirely-app.github.io)显示未归档、最近推送2026-10-27。

**建议与限制。** 暂不排入当前纯JS批次。客户端与预览模板WASM都通过后，再验证Pyodide资源、worker、包体与启动时间。另一条路线是将Python求解器外置，但这意味着开发并运行实际服务，不能只做静态图纸。界面可保留实验台、元件器材柜与波形示波器；保存 `.wirely` 原生数据、未完成参数、探针、实验注释，恢复不自动播放。工程仿真精度仍需独立基准，不能因上游营销表述就承诺可直接用于硬件签核。

## 旁支候选与排除

**Speedscope：技术适配不错，但本组未核实社交出处。** [官方README](https://github.com/jlfwong/speedscope/blob/main/README.md)确认其为完全浏览器侧的性能数据查看器，提供Time Order、Left Heavy和Sandwich视图，支持多种采样格式；[MIT](https://github.com/jlfwong/speedscope/blob/main/LICENSE)，[package.json](https://github.com/jlfwong/speedscope/blob/main/package.json)显示Preact和TS构建，当前1.25.0。[官方元数据](https://api.github.com/repos/jlfwong/speedscope)显示未归档、最近推送2026-05-15。可考虑原始profile→火焰图定位→标注瓶颈→审阅会话；保存原件、过滤/选区、视图与未完成备注。不是采样器，不能假装工作台已经自动分析正在运行的程序。本组多轮Reddit/X搜索没有取得可核实帖子，因此不计入“来自社交讨论的六个新候选”；若其他研究组找到真实链接，可再补。

- **Kiri:Moto、JSCAD、GPX Studio、OpenChemLib JS等**已在旧垂直研究中，不作为本轮新增；Kiri:Moto仍有WASM/worker门槛。
- **2026年光学沙盒帖的主角**在发帖时尚计划开源，本组没有核实其后续公开源码和许可，因此没有用256票将其列成可转换开源项目。Ray Optics是另一个有源码的项目。
- 所有建议都以原生输入、真实核心引擎、可回导输出为目标；若只实现备注表或外链入口，应明确降级命名，不能计为已完成转换。
