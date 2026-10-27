# 小众行业垂直工作台：28 个项目

核查日期：2026-10-27。三个研究子代理与主线程并行阅读官方仓库、许可证、包清单和文档。与原有 50 项去重后，本表收录 **28 个新项目，其中 2 个为维护/迁站观察项**；不包含下文排除项。GeoTIFF.js 跨农业和地学，仅计一次。

**9 个优先原型**：Maker.js、DXF Viewer、farmOS-map、Mirador、GPX Studio、SeqViz、OpenChemLib JS、3Dmol.js、OpenSheetMusicDisplay。它们的专业输入输出与嵌入接口较明确；这个排序是工程判断，尚未运行候选或完成工作台验收。

下表“工作台”是建议新增的产品流程，不能视为上游现成完整功能。每项上游现有能力、具体接口、许可原文及新增部分都在分领域笔记中区分。业务项目管理、SQLite 持久化、版本、批注与报告往往需要我们实现。

## 制造工程

| 编号 | 行业 / 项目 | 建议工作台流程 | 初筛 / 难度 | 许可与关键边界 |
| --- | --- | --- | --- | --- |
| V01 | 激光切割／机箱加工<br>[Maker.js](https://github.com/microsoft/maker.js) | 尺寸与孔位 → 参数化面板/刀模 → SVG、DXF | 优先 / 低–中 | Apache-2.0；使用固定参数模板，避免任意脚本 Playground |
| V02 | 机加工／建筑深化<br>[DXF Viewer](https://github.com/vagran/dxf-viewer) | DXF 图纸 → 图层审阅、问题标注 → 审图记录 | 优先 / 中 | MPL-2.0；不是完整 CAD；worker、字体须同源 |
| V03 | 小批量治具／夹具<br>[JSCAD](https://github.com/jscad/OpenJSCAD.org) | 预设零件与尺寸 → 几何生成 → STL、参数档案 | 适配 / 中 | MIT；默认 regl 渲染器与 CSP 冲突，需换预览 |
| V04 | 钣金／亚克力／板材加工<br>[SVGnest](https://github.com/Jack000/SVGnest) | 零件轮廓与板材 → 不规则排样 → 排样 SVG | 适配 / 中–高 | MIT；动态 Blob/eval worker 必须改造；维护较慢 |
| V05 | PCB 手焊／备料／返修<br>[InteractiveHtmlBom](https://github.com/openscopeproject/InteractiveHtmlBom) | 预转换板图与 BOM → 位号联动、装配勾选 → 进度/缺料记录 | 适配 / 中–高 | MIT；原始 KiCad 转换依赖外部 Python/Pcbnew；不能直接嵌入原 HTML |
| V06 | BIM 数据交付<br>[web-ifc](https://github.com/ThatOpen/engine_web-ifc) | IFC → 构件属性与缺项规则 → CSV、核查报告 | 专项 / 高 | MPL-2.0；浏览器 WASM 被阻止；Node WASM 路线待验证 |
| V07 | 3D 打印／CNC 工坊<br>[Kiri:Moto](https://github.com/GridSpace/grid-apps) | 模型与工艺参数 → 切片/路径规划 → G-code | 专项 / 高 | MIT（第三方分别核查）；WASM、worker 与完整应用拆分；可能需外部切片服务 |
| V08 | 服装量体定制<br>[FreeSewing](https://github.com/freesewing/freesewing) | 量体数据与版型 → 参数制版 → SVG 纸样 | 观察 / 中 | MIT（已核归档版本）；GitHub 已归档迁 Codeberg；新源需重新核查 |
| V09 | PCB 打样审阅<br>[tracespace](https://github.com/tracespace/tracespace) | Gerber/钻孔文件 → 分层叠图 → SVG、审阅记录 | 观察 / 中 | MIT；官方暂停维护，v5 未完成；需承接 v4 维护 |

## 农业与专业运营

| 编号 | 行业 / 项目 | 建议工作台流程 | 初筛 / 难度 | 许可与关键边界 |
| --- | --- | --- | --- | --- |
| V10 | 农业／牧场／塘口登记<br>[farmOS-map](https://github.com/farmOS/farmOS-map) | 地块边界 → 圈绘、面积核对、分区记录 → GeoJSON/WKT | 优先 / 中 | MIT；底图及外部地图接口单独接入；不是养殖决策算法 |
| V11 | 古籍／博物馆／档案<br>[Mirador](https://github.com/ProjectMirador/mirador) | IIIF 清单或扫描页 → 并排校勘 → 对照会话、复核清单 | 优先 / 中 | Apache-2.0；需同源 IIIF 资源；新增批注编辑需开发 |
| V12 | 林业巡护／设施巡线<br>[GPX Studio](https://github.com/gpxstudio/gpx.studio) | 多份 GPX → 裁剪、拆分合并 → 区段轨迹与交付包 | 优先 / 中 | MIT；复用内部 TS 源码；自动寻路/高程依赖外部服务 |
| V13 | 历史地图／城市档案<br>[Allmaps](https://github.com/allmaps/allmaps) | 扫描地图与控制点 → 配准复核 → 配准标注、控制点表 | 适配 / 中–高 | 子包 MIT；应用 GPL-3.0；整仓 Node 24；选纯 JS 子包，避开 WASM 路径 |
| V14 | 农业遥感／无人机交付<br>[GeoTIFF.js](https://github.com/geotiffjs/geotiff.js) | GeoTIFF → 波段、坐标系与样本检查 → 质量表、抽样 CSV | 适配 / 中 | MIT；限制已验证的纯 JS 压缩格式；不含完整遥感分析 |
| V15 | 畜牧／农业试验站<br>[farmOS.js](https://github.com/farmOS/farmOS.js) | 资产与日志模型 → 批次/转场记录 → 台账与同步队列 | 适配 / 中–高 | MIT（LICENSE/package；README 徽章冲突）；实验性 beta，schema 与外部 farmOS 版本必须对齐 |
| V16 | 测绘／林业／三维文物<br>[Potree](https://github.com/potree/potree) | 已转换点云 → 剖面、测量、标注 → 检查记录 | 专项 / 高 | BSD-2-Clause（资源另计）；原始点云转换在外部完成，压缩解码受 CSP 约束 |
| V17 | 冷链配送／上门维保<br>[VROOM](https://github.com/VROOM-Project/vroom) | 任务、车辆与时间窗 → 服务端排线 → 车辆任务单 | 外部服务 / 高 | BSD-2-Clause；C++ 求解与路网引擎必须外置 |
| V18 | 渔船／游艇机务<br>[Signal K InstrumentPanel](https://github.com/SignalK/instrumentpanel) | 既有船舶数据流 → 仪表复核、维护备注 → 交班记录 | 外部服务 / 高 | Apache-2.0；旧 React 16、外部 Signal K、同源传输适配 |

## 实验室与科研

| 编号 | 行业 / 项目 | 建议工作台流程 | 初筛 / 难度 | 许可与关键边界 |
| --- | --- | --- | --- | --- |
| V19 | 分子生物学／质粒资料<br>[SeqViz](https://github.com/Lattice-Automation/seqviz) | 序列与特征区间 → 环形/线性核对 → 选区序列、标注清单 | 优先 / 低–中 | MIT；查看器，不是完整编辑器；关闭外部字体并验证坐标 |
| V20 | 合成化学／样本登记<br>[OpenChemLib JS](https://github.com/cheminfo/openchemlib-js) | SMILES/Molfile 或绘制结构 → 结构核对与比对 → SVG、结构登记表 | 优先 / 中 | BSD-3-Clause；用已编译 JS，不引入 Java/GWT；格式往返需专业样本 |
| V21 | 结构生物学／分子教学<br>[3Dmol.js](https://github.com/3dmol/3Dmol.js) | PDB/SDF → 选择、着色、标记 → PNG、场景与选区清单 | 优先 / 中 | BSD-3-Clause（含第三方声明）；首版无表面计算、无字符串回调；不含结构预测 |
| V22 | 蛋白质组学／质谱实验室<br>[Lorikeet](https://github.com/UWPR/Lorikeet) | 峰列表与肽段信息 → MS/MS 碎片离子核对 → 审阅表与参数 | 适配 / 中 | MIT；旧 jQuery/Flot，2023 后无 push；不负责仪器 RAW 解析 |
| V23 | 生物信息学／测序研究<br>[igv.js](https://github.com/igvteam/igv.js) | 参考与轨道文件 → 区间证据审阅 → 会话、SVG、ROI 表 | 适配 / 中–高 | MIT；同源参考/索引与范围读取；大文件、编解码逐一验证 |
| V24 | 神经影像研究<br>[NiiVue](https://github.com/niivue/niivue) | NIfTI 与覆盖图 → 三向切片及研究标注 → 截图、会话 | 适配 / 中–高 | BSD-2-Clause；迁往新 monorepo；首版 NIfTI，附加插件另验 |
| V25 | 显微成像／组织切片研究<br>[Viv](https://github.com/hms-dbmi/viv) | OME-TIFF/Zarr → 多通道、Z/T 平面与 ROI → 截图、视图配置 | 专项 / 高 | MIT；预转换格式、大资源管理、codec/worker 矩阵 |
| V26 | DICOM 研究与教学<br>[DWV](https://github.com/ivmartel/dwv) | 研究 DICOM 文件集 → 检查、查看、测量 → 研究记录和截图 | 专项 / 中–高 | GPL-3.0（项目声明）；稳定版本、GPL 分发方案与 decoder worker 专项验证 |

## 演出与音乐

| 编号 | 行业 / 项目 | 建议工作台流程 | 初筛 / 难度 | 许可与关键边界 |
| --- | --- | --- | --- | --- |
| V27 | 乐团／音乐出版<br>[OpenSheetMusicDisplay](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay) | MusicXML/MXL → 声部/版式审阅 → 乐谱图与批注清单 | 优先 / 中 | BSD-3-Clause；是渲染器；完整制谱和播放器不计入首版 |
| V28 | 演出灯光／灯具租赁<br>[Open Fixture Library](https://github.com/OpenLightingProject/open-fixture-library) | 灯具与 DMX 模式 → 校验、场次整理 → 控制台定义与附件 | 适配 / 中 | MIT；整站 Node 24/Nuxt；抽模块、固定数据格式，不控制硬件 |

## 如何选择下一批

- **先交付独立流程**：参数化面板、DXF 审图、质粒审阅、化学结构登记、分子标注、地块边界、馆藏对照、巡检轨迹、乐谱审校。先各选一种真实文件/样本，验证保存恢复与导出。
- **有明确适配再推进**：SVGnest 的静态 worker、JSCAD 的替代渲染器、iBOM 的预转换 JSON、Allmaps 的纯 JS 子包、GeoTIFF 的限定压缩路径。它们有行业用途，但不能仅加一个 React 外壳。
- **具备设施后推进**：VROOM 排线需要优化/路由服务；Signal K 需要船舶数据服务。web-ifc/Kiri:Moto 要先过运行时关卡；Potree/Viv 需要可复用的专业数据预处理链。

## 当前模板的实测限制

当前锁定模板使用 Node 22、React 19.2.3 和 SQLite，浏览器 CSP 为 script-src self、connect-src self。最小 WebAssembly 模块已在真实 Chrome 预览中被阻止，见 [实测记录](template-csp-probe.json)。因此浏览器 WASM 不是直接接入路线；同源放置文件不能解除限制。Node WASM 或独立服务属于待验证的替代方案。

动态 eval、Blob worker、外部字体/数据接口也需按固定模板适配。专业大文件必须作为可恢复资源管理，不能只保存失效的临时 URL。此处没有修改模板 CSP，也没有将这些候选标成已实现。

## 观察与排除

- **FreeSewing**：GitHub 于 2025-04-02 归档迁至 Codeberg；表中保留行业方向，实施前重新核查新官方源。
- **tracespace**：官方明确暂停维护，v5 未完成；若选用 v4，需要承担维护成本。
- **NMRium**：所查当前根仓库 MIT，但依赖的 nmrium-core@0.7.81 为 CC-BY-NC-SA-4.0，React peer 也高于当前模板，未进入候选表。
- **JS9**：停止积极维护，FITS 路径另有 WASM 关卡，未进入候选表。
- **Open Vector Editor**：需要完整序列编辑时可另查；当前旧框架及 monorepo 依赖增加适配成本，暂用 SeqViz 的审阅范围优先。

后面三项的具体版本、许可与官方证据见 [科研调研](niche-laboratory.md#已核实但不列入本轮九项的候选)。许可应按选定版本和实际依赖确认，根项目许可不能替代依赖许可；这里只记录已查事实，不宣称整个依赖树已完成分发审计。

## 详细证据

- [制造、工程与设计生产](niche-manufacturing.md)：9 项，含 2 个观察项。
- [农业、测绘、路线、文博与船舶运维](niche-operations.md)：9 项。
- [实验室、科研与专业影像](niche-laboratory.md)：9 项，与上一组共用 GeoTIFF.js。
- [演出与音乐](niche-creative.md)：2 项。
- [结构化清单](niche-candidates.json)：28 个唯一仓库，状态均为 researched-not-built。

调研仅完成源码与文档核查；全部候选的实际构建、浏览器流程、专业样本正确性和 Floatboat 客户端导入仍待实施验收。
