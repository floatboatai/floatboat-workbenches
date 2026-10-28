# 下一批工作台候选：Reddit 与 X 调研

核查日期：2026-10-28。主线程与3个研究子代理核查了23个候选方向，均与现有72项catalog去重；其中22项有可定位的Reddit/X线索，Speedscope只作为源码侧补充。未安装运行候选，没有把研究项目写成已实现，也没有改变现有工作台数量。

建议先验证 **Ray Optics、Invoice Builder、Oasis Editor、CircuitJS、Mesh2Motion、glTF Transform** 六项。它们分别提供光学实验、单据制作、分页文档、电路仿真、角色动画、模型交付检查的原生能力。下列工作台范围和排序是工程建议；全部仍需通过固定模板、自动保存与真实文件往返测试。

## 优先六项

| 项目与官方源码 | 建议工作台及专用布局 | 最小原生闭环 | 适配关卡 | 社交线索 |
| --- | --- | --- | --- | --- |
| [Ray Optics Simulation](https://github.com/ricktu288/ray-optics) | 光路实验台：全幅光路、器材抽屉、参数与测量条 | 原生Scene/Simulator/Editor → CPU光线追踪 → 场景JSON与实验记录 | Apache-2.0；先限定基础元件，公式与WebGPU另验 | [Reddit：AR眼镜实际用途，2024-11-02](https://www.reddit.com/r/raspberry_pi/comments/1gi9b6r/ive_built_a_selfcontained_pair_of_ar_goggles/)；历史线索 |
| [Invoice Builder](https://github.com/piratuks/invoice-builder) | 报价与发票制作：明细表、纸张校样、历史快照 | 原生计算/文档模型、PDF模板 → 可回读单据与PDF | MIT；适配Electron IPC、sqlite3/pg及字体，首版不做自动记账/寄送 | [Reddit：作者更新，2026-08-26](https://www.reddit.com/r/selfhosted/comments/1vz6rxg/update_invoice_builder_7_months_ago_i_shared_my/) |
| [Oasis Editor](https://github.com/celsowm/oasis-editor) | DOCX分页校样：连续纸张、页缩略图、排版工具 | 原生Canvas分页及React挂载 → 编辑 → DOCX/PDF往返 | MIT；早期项目，React适配为mount-only，复杂文档保真待测 | [Reddit：作者介绍，2026-08-31](https://www.reddit.com/r/opensource/comments/1w3corq/im_building_an_opensource_docx_document_editor/) |
| [CircuitJS1](https://github.com/pfalstad/circuitjs1) | 电路实验台：电路图、元件参数、示波器 | 当前TypeScript求解器 → 原生电路快照 → 波形与试验记录 | 源码GPL-2.0-or-later；不要采用package的ISC误标，原生输入需完整捕获 | [Reddit：教学选型，2026-08-17](https://www.reddit.com/r/AskElectronics/comments/1vqnt1c/is_it_legal_to_use_voltsim_app_to_similulate/) |
| [Mesh2Motion](https://github.com/Mesh2Motion/mesh2motion-app) | 角色绑定台：3D视口、骨架树、动作片段 | 普通GLB → 调整骨架/绑定 → 预览与导出动画GLB | 代码MIT、资产CC0；贴图blob URL需改为模板允许的资源路径，压缩模型另验 | [X：作者演示，2026-09-17](https://x.com/scottpetrovic/status/2100562741626880208) |
| [glTF Transform](https://github.com/donmccurdy/glTF-Transform) | 3D交付检查台：场景树、材质检查、资源体积表 | 原生NodeIO/core → 检查/修改普通GLB → 导出后再解析 | MIT；首版不包含未经验证的Draco/KTX2/纹理压缩与全套optimize | [Reddit：大型模型实际使用，2025-12-16](https://www.reddit.com/r/threejs/comments/1pnnlm4/handling_huge_gltfglb_models_in_threejs_110m/) |

**最适合先开工的三个方向是 Ray Optics、Invoice Builder、Mesh2Motion。** 三者的工作对象和界面差异明显，也能各自收敛为一个真实的导入—编辑—保存—导出流程。若优先办公用途，则以Oasis替换Mesh2Motion；Oasis必须先过复杂DOCX样本测试，不能因提供React适配器就视为成熟Office替代品。

## 有条件的下一梯队

| 项目 | 建议用途 | 为什么暂不和前六项一起直接开做 |
| --- | --- | --- |
| [KiCanvas](https://github.com/theacodes/kicanvas) | PCB原理图/板图审阅、问题单与交付清单 | MIT含第三方通知；alpha，嵌入选择/视口事件不完整。先做事件桥接探针；不是PCB走线编辑器。[Reddit线索，2026-06-30](https://www.reddit.com/r/KiCad/comments/1uk32d1/i_built_a_browserbased_viewer_for_kicad_projects/) |
| [Data Formulator](https://github.com/microsoft/data-formulator) | CSV数据探索、分析分支、图表与报告 | MIT；需真实Python分析/执行服务，首版限定单CSV，不以生成图表的聊天框替代上游引擎。[X线索，2026-05-10](https://x.com/HowToPrompt__/status/2053469999298416795) |
| [Scrapling](https://github.com/D4Vinci/Scrapling) | 公开目录采集、字段抽取与批次校验 | BSD-3-Clause；需Python服务，动态页面另需浏览器。先做上传HTML或公开静态页面。[X线索，2026-02-23](https://x.com/heynavtoor/status/2025963356293943308) |
| [Grocy](https://github.com/grocy/grocy) | 耗材/食材盘点、临期与配方核对 | MIT；真实业务在PHP/SQLite服务内，工作台通过REST API接入。[Reddit实际使用](https://www.reddit.com/r/grocy/comments/1vvjnw7/has_anyone_else_gone_overboard_with_grocy_like_me/) |
| [Forms-Engine](https://github.com/JoshuaLeoSmith/forms-engine) | 条件问卷规则和版本预演 | MIT；可抽独立规则核/Lit renderer，完整Java/Mongo服务后置。与已有SurveyJS重叠，优先级稍低。[Reddit作者帖，2026-09-19](https://www.reddit.com/r/angular/comments/1wk7etu/open_source_form_engine_where_the_whole_editor_is/) |
| [OpenPost](https://github.com/getopenpost/openpost) | 多平台文案和素材校样 | AGPL-3.0-only；适合抽稿件/平台预览切面，整套媒体编辑有WASM/GPU依赖。[Reddit作者帖，2026-09-07](https://www.reddit.com/r/foss/comments/1wa2075/free_opensource_image_and_video_editors_in_the/) |
| [OpenBB ODP](https://github.com/openbq-org/OpenBB) | 公司/宏观数据研究、来源快照与笔记 | 当前源码Apache-2.0；独立Python接口、具体供应商可用性和治理迁移需先核对。[X线索，2026-07-28](https://x.com/He1s_Sammy/status/2082076288370593817) |

## 暂缓与补充

- **Wirely、MasterSelects**：分别涉及Pyodide、媒体WASM/GPU；客户端和预览模板尚未确认就绪。MasterSelects还要求Node24，公开代码也不包含私有hosted kernel。
- **Blockbench**：虽有真实X创作示例，但整站Vue2运行时模板编译和插件机制需要先过固定CSP，不能直接当React组件。
- **Open MCT**：适合遥测回放，当前Node>=24.14.1与模板Node22不符，需确定固定兼容构建。
- **marimo＋Lens**：适合反应式分析笔记，但Python内核、会话和执行恢复的接入成本较高。Lens只是上下文关联widget，不独立执行分析。
- **EdenText**：分页办公方向有价值，Svelte整站适配和拼写/语法WASM路径需处理，当前仍beta。
- **SnapOtter（原Stirling Image）**：适合真实服务驱动的批量媒体处理，现版后端和商业模块边界比旧Reddit帖复杂。
- **OpenSub**：当前根许可与package标注不一致，且依赖Tauri/Rust/Whisper，先澄清许可及运行边界。
- **EditorScripts**：依赖DaVinci Resolve Studio，不属于独立浏览器工作台。
- **Speedscope**：MIT、浏览器性能数据查看器，技术上值得保留，但本轮未核到合格Reddit/X帖子，未混入社交发现清单。

这些项目的社交原帖、版本、源码入口、依赖和许可原文均在后面的分组报告中逐项链接。没有把旧项目当本周热点，也没有把演示站或商业功能当作已经可用的开源能力。

## 后续转化的共同验收范围

1. 固定上游版本，保留真实核心引擎及许可，不做只有相似界面的空壳。
2. 用真实文件在当前模板中验证核心导入/编辑/导出。基础功能先跑通，WASM、特殊压缩格式和独立服务分别验收。
3. 自动保存完整工作副本：原始文件/资源、原生文档、未完成表单输入、视图状态和备注。恢复不能自动执行模拟、代码、网络采集或写回远端。
4. 产品布局围绕实际对象设计。批量交付仍要逐项验证刷新、切换、离线、冲突、恢复稿回导与导出，并补真实截图。

## 证据报告

- [Reddit应用：8项](reddit-discovery-2026-10-28.md)
- [X工具：6项](x-discovery-2026-10-28.md)
- [垂直工具：6项＋Speedscope补充](specialist-discovery-2026-10-28.md)
- [EdenText与SnapOtter：2项](additional-discovery-2026-10-28.md)

X网页有403，本轮具体帖子通过官方公开oEmbed核对作者、日期与可读取正文；部分长帖截断，未统一取得互动数。Reddit使用实际帖子或可定位评论；只有搜索摘要的地方已注明。功能与许可结论来自官方源码/文档，适配方案为尚待实施验证的工程判断。
