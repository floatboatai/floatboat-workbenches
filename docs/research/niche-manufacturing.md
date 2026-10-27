# 制造、工程与设计生产：9 个垂直工作台候选

核查日期：2026-10-27。仅做官方 README、LICENSE、源码、文档及 GitHub 元数据调研；未安装或构建这些候选，未改应用或 catalog。已对照现有 50 项目录去重。本文“工作台流程”是建议实现的产品范围；“现成能力”才是上游已有功能。

**建议先做 Maker.js 刀模/面板生成、DXF 生产图审阅、JSCAD 参数夹具。** 前两项边界清楚；JSCAD 只用几何计算与导出模块，需替换其默认渲染器。FreeSewing 单列迁站观察，tracespace 单列停更观察，不与当前维护的主候选混淆。

## 模板适配基线

- Node 22、React 19、SQLite；沿用固定构建器，不安装原生扩展或桌面程序。JS 引擎通过函数接口或 DOM 容器接入 React；SQLite 保存参数、版本、审阅/装配记录，原始图纸和产物按工作空间附件保存。
- `script-src 'self'`、`connect-src 'self'`，没有 `unsafe-eval`、`wasm-unsafe-eval`；worker/font 继承同源限制。第三方 CDN、远程字体、Blob worker、内联事件处理器不能原样搬入。
- **主线程已在官方模板 Chrome 预览中实测：最小 `WebAssembly.instantiate` 被 CSP 阻止。** [实测记录](template-csp-probe.json)。因此 WASM 在浏览器执行是明确平台关卡；下文 Node WASM/外部服务路线是待验证的适配建议，并非已通过兼容性测试。把 WASM 文件放同源不能解除编译限制。
- 所有外部服务只经工作台 Node 同源 API 转接。没有候选因“网站能运行”而被判为可直接嵌入。AI 最适合补结构化参数、检查说明、汇总报告；几何、套料、切片结果必须由真实引擎计算。

## 精选短表

A＝优先原型；B＝值得做但有明确适配成本；C＝专项验证；O＝观察。难度针对表中限定范围。

| 项目 / 目标用户 | 建议工作台：输入 → 处理 → 输出 | 接入与难度 / 优先级 | 核实许可与当前状态 |
|---|---|---|---|
| [Maker.js](https://github.com/microsoft/maker.js)；激光切割、机箱面板、木工夹具设计师 | 长宽、孔位、板厚/圆角 → 参数图形及布尔运算 → SVG / DXF 与参数版本 | JS 引擎，React 参数表单；低–中 / **A** | [Apache-2.0](https://github.com/microsoft/maker.js/blob/master/LICENSE)；未归档，最近推送 [2026-10-18](https://api.github.com/repos/microsoft/maker.js) |
| [DXF Viewer](https://github.com/vagran/dxf-viewer)；加工厂审图、建筑深化人员 | DXF → 图层开关、图形定位和人工标注 → 审阅清单 / 标注 JSON | DOM + WebGL；中 / **A** | [MPL-2.0](https://github.com/vagran/dxf-viewer/blob/master/LICENSE)；v1.0.50 发布于 2026-10-17 |
| [JSCAD](https://github.com/jscad/OpenJSCAD.org)；小批量夹具、治具、3D 打印零件设计 | 受限零件模板 + 尺寸 → CSG 几何生成 → STL 与参数记录 | Node/浏览器纯 JS 几何，另做预览；中 / **A** | [MIT](https://github.com/jscad/OpenJSCAD.org/blob/master/LICENSE)；未归档，最近推送 [2026-10-21](https://api.github.com/repos/jscad/OpenJSCAD.org) |
| [SVGnest](https://github.com/Jack000/SVGnest)；钣金、亚克力、激光切割店 | 闭合 SVG 零件、板材轮廓、间距 → 不规则排样 → 排样 SVG / 用料记录 | 需重写动态 worker 调度；中–高 / **B** | [MIT](https://github.com/Jack000/SVGnest/blob/master/LICENSE.txt)；未归档，最近推送 [2024-02-01](https://api.github.com/repos/Jack000/SVGnest) |
| [InteractiveHtmlBom](https://github.com/openscopeproject/InteractiveHtmlBom)；PCB 手焊、备料、返修人员 | 预转换的 PCB/BOM JSON → 位号与板图联动、装配勾选 → 装配进度 / 缺料记录 | 重用 JS 板图逻辑；原始 PCB 转换需外部 ECAD/Python；中–高 / **B** | [MIT](https://github.com/openscopeproject/InteractiveHtmlBom/blob/master/LICENSE)；v2.12.0 发布于 2026-09-10 |
| [web-ifc](https://github.com/ThatOpen/engine_web-ifc)；BIM 交付质检、建筑数据整理 | IFC → 属性抽取、分类与缺失字段规则 → 构件 CSV / 核查报告 | **浏览器 WASM 阻塞**；优先验证 Node WASM；高 / **B** | [MPL-2.0](https://github.com/ThatOpen/engine_web-ifc/blob/main/LICENSE.md)；未归档，最近推送 [2026-10-27](https://api.github.com/repos/ThatOpen/engine_web-ifc) |
| [Kiri:Moto / GridSpace](https://github.com/GridSpace/grid-apps)；3D 打印、CNC 与激光工坊 | STL + 设备/刀具/工艺参数 → 切片、路径规划 → G-code / 配置档案 | worker、WASM 和完整应用拆分；高 / **C** | [MIT](https://github.com/GridSpace/grid-apps/blob/master/license.md)；未归档，最近推送 [2026-10-22](https://api.github.com/repos/GridSpace/grid-apps) |
| [FreeSewing](https://github.com/freesewing/freesewing)；量体定制、服装纸样人员 | 量体数据 + 预选版型 → 参数化制版 → SVG 纸样 / 尺寸档案 | JS 核心可封装；迁站后的版本需另核；中 / **O：迁站** | 已核 GitHub 代码 [MIT](https://github.com/freesewing/freesewing/blob/develop/LICENSE)；2025-04-02 归档，官方迁往 Codeberg |
| [tracespace](https://github.com/tracespace/tracespace)；PCB 打样采购、生产文件审阅 | Gerber / NC drill → 分层解析、板图叠合 → SVG / 文件层次清单 | v4 Node JS 管线可封装；需承接维护；中 / **O：停更** | [MIT](https://github.com/tracespace/tracespace/blob/main/LICENSE)；官方无限期暂停，v5 未完成 |

“最近推送”来自当日官方 GitHub API，不代表版本已发布或兼容性已验证。元数据入口为 `https://api.github.com/repos/{owner}/{repo}`；上表分别对应其仓库链接。版本日期另见 [DXF releases](https://github.com/vagran/dxf-viewer/releases)、[iBOM releases](https://github.com/openscopeproject/InteractiveHtmlBom/releases)。

## 能力边界与落地细节

### 1. Maker.js：最适合先做刀模、孔板和面板

现成能力包括线/弧/圆、模型组合、单位换算、测量、布尔运算、圆角及 DXF/SVG 导出；模型是可序列化的 JS 对象。不是通用 DXF 文件编辑器。[官方 README](https://github.com/microsoft/maker.js/blob/master/README.md)

建议直接调用 `makerjs` API，内置“安装孔板、控制面板、激光切割轮廓”等参数模板，保存输入和计算结果；不搬入可执行任意 JS 的 Playground。这样 React 19 只负责表单和预览，Node 22 可承担计算。字体仅在需要文字轮廓时引入同源文件，PDF 不作为第一版承诺。Apache-2.0 分发需保留许可、相关声明及修改说明；不要把上游商标当成产品品牌。[许可](https://github.com/microsoft/maker.js/blob/master/LICENSE)

### 2. DXF Viewer：审图工具，避免承诺完整 CAD

现成组件使用 Three.js/WebGL，支持图层控制、视图定位及坐标转换；提供 `Load`、`GetLayers`、`ShowLayer`、`Destroy`，可指定 worker factory。[README](https://github.com/vagran/dxf-viewer/blob/master/README.md)、[API](https://github.com/vagran/dxf-viewer/blob/master/docs/api.md)

React 用 ref 挂载容器、卸载时释放资源。上传文件和字体由同源 API/静态路径提供；worker 必须是同源静态模块，不使用 Blob URL。测距、审阅标注与导出清单属于工作台新增功能。原库对纸空间、部分尺寸/文字样式等支持不完整，不能声称 DWG 支持或工业 CAD 等价。MPL-2.0 是文件级开放义务：分发修改过的覆盖文件需提供对应源码，独立业务文件可分别许可。[能力限制](https://github.com/vagran/dxf-viewer/blob/master/README.md)、[许可](https://github.com/vagran/dxf-viewer/blob/master/LICENSE)

### 3. JSCAD：只用几何模块生成参数零件

`@jscad/modeling` 提供 JS CSG，`@jscad/stl-serializer` 能把几何转成浏览器 Blob 或 Node Buffer。适合预设夹具、垫片、外壳等可控参数流程。[模块说明](https://github.com/jscad/OpenJSCAD.org/blob/master/README.md)、[modeling 包](https://github.com/jscad/OpenJSCAD.org/blob/master/packages/modeling/package.json)、[STL 序列化](https://github.com/jscad/OpenJSCAD.org/blob/master/packages/io/stl-serializer/README.md)

**不能直接采用默认 `@jscad/regl-renderer`**：该包依赖 regl，后者源码通过 `Function.apply` 生成可执行函数，与无 `unsafe-eval` 的 CSP 冲突。建议固定参数模板在 Node 计算，前端另接不依赖运行时 JS 代码生成的网格查看器；替代渲染路线仍要实测。不上线任意脚本编辑和执行。[依赖声明](https://github.com/jscad/OpenJSCAD.org/blob/master/packages/utils/regl-renderer/package.json)、[regl 代码生成源码](https://github.com/regl-project/regl/blob/master/lib/util/codegen.js)。JSCAD 代码为 MIT，分发保留许可与版权声明。

### 4. SVGnest：行业价值高，worker 改造必须先做

现成算法处理不规则轮廓、凹多边形及孔内排样，提供零件间距、曲线近似容差、旋转和遗传算法参数。输入须预先转成不重叠的闭合轮廓；不能把排样启发式结果称为全局最优。[官方 README](https://github.com/Jack000/SVGnest/blob/master/readme.md)

源码的 Parallel 调度器把函数转成字符串，使用 Blob worker 或 eval.js 路径；直接搬入会触及当前 CSP。应抽出固定算法到同源静态 worker，补取消、超时、进度和结果恢复，禁用 SVG 外部引用与脚本，再做真实复杂零件验收。仅“换成 React 壳”不够；此项不评级为低成本。[worker 源码](https://github.com/Jack000/SVGnest/blob/master/util/parallel.js)、[MIT](https://github.com/Jack000/SVGnest/blob/master/LICENSE.txt)

### 5. InteractiveHtmlBom：装配工位比通用 BOM 表更有价值

上游已有 BOM 与 PCB 位置双向联动、搜索、可选网络高亮，以及自包含 HTML；官方还定义了 `pcbdata` JSON。适合围绕“找元件 → 核对 → 勾选已焊”设计工作台，SQLite 增加批次和进度记录。[README](https://github.com/openscopeproject/InteractiveHtmlBom/blob/master/README.md)、[数据格式](https://github.com/openscopeproject/InteractiveHtmlBom/blob/master/DATAFORMAT.md)

原始 KiCad 转换使用 Pcbnew Python API，不能在禁止原生运行时的模板里安装 KiCad。第一版接受已转换 JSON；需要原档转换时再接独立转换环境。生成的 HTML 含内联脚本与 `onchange`，**不能直接 iframe 上传 HTML**；改成受信任的静态 JS/React 事件绑定，只把校验后的数据注入。MIT 覆盖插件代码，嵌入的第三方库仍须保留各自声明。[Python 依赖](https://github.com/openscopeproject/InteractiveHtmlBom/blob/master/pyproject.toml)、[HTML 模板](https://github.com/openscopeproject/InteractiveHtmlBom/blob/master/InteractiveHtmlBom/web/ibom.html)、[许可](https://github.com/openscopeproject/InteractiveHtmlBom/blob/master/LICENSE)

### 6. web-ifc：先做构件属性交付核查

现成引擎可读写 IFC 并访问属性/几何，API 包含 `IfcAPI.Init`、`OpenModel`、`CloseModel`；发布构建明确包含 Node 用 `web-ifc-api-node.js` 与 `web-ifc-node.wasm`。[官方 README](https://github.com/ThatOpen/engine_web-ifc/blob/main/README.md)

浏览器 WASM 路径被当前 CSP 阻塞。建议先验证 Node 22 加载随发布包提供的 WASM，再从同源 API 返回构件字段和汇总数据；不要在运行时编译 C++。需确认固定打包器保留 WASM 资产、内存释放和文件大小限制。第一版做属性缺失/命名规则报告，工程量推导和碰撞检测不是上游接口自动附送的能力。若 Node 路线不通过，再考虑独立服务。MPL-2.0 修改/分发义务与 DXF Viewer 同类。[Node 构建说明](https://github.com/ThatOpen/engine_web-ifc/blob/main/README.md#build-files)、[许可](https://github.com/ThatOpen/engine_web-ifc/blob/main/LICENSE.md)

### 7. Kiri:Moto：能力完整，现阶段只建议专项验证

现成引擎面向 FDM、CAM、激光；官方 Engine API 给出 `parse`、设备/工艺设置、`slice → prepare → export`，可生成 G-code。工作台可管理模型、设备参数和计算记录，但不能用模拟进度替代实际切片。[官方 README](https://github.com/GridSpace/grid-apps/blob/master/readme.md)、[Engine API](https://grid.space/kiri/engine.html)

其 worker 有静态模块路径，也有 Blob 分支；几何模块明确调用 `WebAssembly.instantiate`。所以不是外链 iframe 即可用，也不能假定所有模式都存在可用的纯 JS 回退。先限定单一 FDM/激光模式，核查静态 worker、所有 WASM 依赖及 Node 适配可行性；不通过则使用独立切片服务经 Node 转接。第一版只下载待操作员核对的 G-code，不直接控制设备。根代码 MIT，不代表所有随附第三方几何库自动继承 MIT。[workers](https://github.com/GridSpace/grid-apps/blob/master/src/kiri/app/workers.js)、[WASM 源码](https://github.com/GridSpace/grid-apps/blob/master/src/geo/wasm.js)、[许可](https://github.com/GridSpace/grid-apps/blob/master/license.md)

### 8. FreeSewing：迁站观察，不作为“GitHub 活跃项目”推荐

归档代码的 `@freesewing/core` 是量体纸样引擎，已有 Brian 男装基础原型等设计；Pattern 具备 `draft()`、`render()` SVG 和渲染数据接口。适合保存客户尺寸、选版型及参数后输出纸样；不等于 3D 布料仿真。[核心说明](https://github.com/freesewing/freesewing/blob/develop/packages/core/README.md)、[Brian](https://github.com/freesewing/freesewing/blob/develop/designs/brian/README.md)、[Pattern 源码](https://github.com/freesewing/freesewing/blob/develop/packages/core/src/pattern/index.mjs)

GitHub 仓库于 2025-04-02 归档，README 指向 [Codeberg 新官方源](https://codeberg.org/freesewing/freesewing)。本次已核 GitHub 代码 MIT；新官方源的发布版本/API/许可需在实施前重新核对，不用归档分支推断新版本。接入时优先核心引擎和有限版型、自建 React 表单，不搬旧站点组件；SVG 同源、无外部字体，分页 PDF 是另需验证的后续工作。[迁站声明](https://github.com/freesewing/freesewing/blob/develop/README.md)、[已核许可](https://github.com/freesewing/freesewing/blob/develop/LICENSE)

### 9. tracespace：停更观察，仅 v4 管线有明确产品边界

v4 的 `gerber-parser`、`gerber-to-svg`、`pcb-stackup` 可在 Node/浏览器解析 Gerber/钻孔并输出分层及整板 SVG。可做打样文件预览、层名确认和人工问题记录；不把图形预览称为完整 DFM 检查。[v4 README](https://github.com/tracespace/tracespace/blob/main/README.md)

默认 v5 分支的官方说明明确无限期暂停维护、v5 尚未完成，不能使用其 `next` API 冒充稳定基础。若接受维护接管，可锁 v4 核心在 Node 22 运行并净化 SVG，React 只做图层与审阅 UI；Node 22 依赖兼容尚未测试。MIT 覆盖代码；README 中 Arduino 示例设计另标 CC BY-SA，不能当成无条件可分发示例。[停更声明](https://github.com/tracespace/tracespace/blob/v5/README.md)、[许可](https://github.com/tracespace/tracespace/blob/main/LICENSE)、[示例数据说明](https://github.com/tracespace/tracespace/blob/main/README.md#examples)

## 推荐推进顺序

1. **Maker.js 面板/刀模**：先限制三种参数模板，验证 SVG/DXF 的单位、孔径与独立软件打开结果。
2. **DXF 生产图审阅**：先做同源文件加载、图层和标注归档；使用真实客户可授权样本覆盖文字/尺寸兼容性。
3. **JSCAD 参数夹具**：先验证纯 JS 核心 + STL 导出 + 替代预览，避免默认 regl 与自由脚本入口。
4. **SVGnest / iBOM**：分别以静态 worker 和受限 JSON 输入作为先决验证，再扩展行业流程。
5. **web-ifc / Kiri:Moto**：先完成运行时可行性验证；FreeSewing、tracespace 保持观察状态。
