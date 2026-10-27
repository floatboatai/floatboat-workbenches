# 行业垂直工作台候选：农业、测绘、路线、文博档案与船舶运维

核验日期：**2026-10-27**。本轮 9 个项目均不在现有 `catalog.json` 的 50 个通用候选中。只核验官方仓库、源码、许可证与官方文档；未安装、构建或宣称通过 Floatboat 验收。下文“工作台建议、接入路径、难度、优先级”是基于证据的工程判断，并非上游已经提供的完整产品。

建议首轮做 **农田/塘口边界台、馆藏图像对照台、巡检轨迹整理台**。它们有明确输入输出，能先交付本地流程。古地图配准和遥感影像检查有较强行业价值，但要先验证选定子包与格式。VROOM、Signal K 列为需要既有服务的后续接入项。

## 模板适配前提

- 保持 Node 22、React 19、SQLite、官方固定构建；不得把 PHP、Python、C++、Rust 服务或原生转换器塞入工作台运行环境。业务记录、版本、审核意见放 SQLite；大型影像、点云与轨迹原件采用附件文件，数据库保存引用。
- 浏览器 `connect-src 'self'`：外部 IIIF 清单、地图元数据、路由接口、农场 API 和船舶 WebSocket 均不能原样直连。优先导入本地文件；需要联网时，经 Node 端固定连接器访问已配置的服务，再提供同源路由。下文的连接器是待实现工作，不是模板自带功能。
- `script-src 'self'` 没有 `unsafe-eval` 或 `wasm-unsafe-eval`。主线程在 2026-10-27 的真实 Chrome 预览中已验证最小 `WebAssembly.instantiate` 被阻止，因此 **“有 WASM 版本”不能作为可直接嵌入的依据**。见 [本地 CSP 实测证据](template-csp-probe.json)。Worker 还需使用同源静态脚本，不能默认依赖 blob Worker。
- 所有 JS/CSS/字体与 Worker 均本地打包，避免官方示例中的 CDN/内联脚本。旧框架应用如需使用其官方浏览器发行包，应放在同源独立文档中并验证消息来源；不能混用其 React 16 与宿主 React 19。
- 每项仍需固定实际发布版本、检查该版本的 LICENSE 与依赖、完成真实输入→处理→导出验证。仓库当前 `package.json` 不等于 npm 版本已发布，也不等于已适配 Node 22。

## 候选概览

| 优先级 | 项目 | 具体工作台 | 接入类别 | 难度 | 关键边界 |
| --- | --- | --- | --- | --- | --- |
| P0 | farmOS-map | 农田、围栏、塘口边界与面积台 | 浏览器 JS 地图组件 | 中 | 地图服务与地理编码须处理同源访问 |
| P0 | Mirador | 馆藏图像并排校勘台 | 浏览器组件，当前 peer 支持 React 19 | 中 | IIIF 清单/图像源接入；批注编辑不是核心自带 |
| P0 | GPX Studio | 巡线、林业巡护轨迹整理台 | 抽取内部 TS GPX 库 | 中 | 内部库未独立公开发布，网站是 SvelteKit |
| P1 | Allmaps | 古地图控制点配准台 | MIT TS 子包 | 中—高 | 应用 GPL-3.0；整仓 Node 24；避开 WASM 路径 |
| P1 | GeoTIFF.js | 农业/水域遥感影像检查台 | JS 栅格解析引擎 | 中 | 首版限制纯 JS 可解码格式；不是现成农艺分析系统 |
| P1 | farmOS.js | 牲畜批次、转场与观察日志台 | JS 领域模型/可选 API 客户端 | 中—高 | beta、模型版本与服务端兼容性需核实 |
| P2 | Potree | 测绘点云剖面与现场标注台 | 浏览器查看器＋外部预处理 | 高 | 原始点云转换器为外部工具；压缩格式逐一验证 |
| P2 | VROOM | 冷链/上门服务多车排线台 | **外部优化服务** | 高 | C++ 求解器及路网引擎不在工作台内运行 |
| P2 | Signal K InstrumentPanel | 船舶机舱/航行仪表巡检台 | **外部船舶数据服务** | 高 | 旧 React 16 前端；连接、时间戳与失联状态需适配 |

P0 表示优先做小范围原型，并非已通过打包；P1 表示需先过兼容性或数据契约关卡；P2 需要外部设施或较多遗留适配。

## 1. farmOS-map：农田、围栏、塘口边界与面积台

**仓库与用户**：[farmOS/farmOS-map](https://github.com/farmOS/farmOS-map)。面向农场管理员、农业社会化服务人员、牧场围栏规划员；塘口边界登记是可扩展用途，不代表上游有水产生产管理功能。

**已核实能力**：基于 OpenLayers 的农业地图；支持点/线/多边形绘制、移动与修改，长度/面积测量，吸附网格，以及 WKT/GeoJSON 导出。上游明确给出 `create()`、`destroy()`、`addBehavior('edit')`、`measure` 等 API。[官方 README](https://github.com/farmOS/farmOS-map/blob/main/README.md)

**建议流程**：地块/塘口 GeoJSON、测量点或手工圈绘 → 边界编辑、面积核对、分区命名、关联任务 → GeoJSON/WKT、分区面积清单、现场作业附件。首版只做边界和空间记录，不自动推导施药量、放养量或产量。

**接入与模板约束**：React 管理项目、清单和编辑状态，命令式挂载地图并在卸载 `destroy()`；SQLite 保存边界版本。优先用本地底图与 GeoJSON；在线地理编码/矢量请求需要同源连接器。官方发行物包含多个 JS/CSS 分块，必须保留其相对路径，不能只拷贝入口 JS。README 的 Webpack 外置示例不意味着要修改模板构建；可先验证同源静态发行物方案。[分块与导出说明](https://github.com/farmOS/farmOS-map/blob/main/README.md#webpack-chunk-loading)

**许可与风险**：**MIT**，保留版权与许可；地图瓦片、Google/其他供应商 API、底图数据的使用条件另算。README 安装示例仍写 `@2`，当前源码包版本标为 3.0.0，实施时须选定版本核对 API，不能将两者混用。[LICENSE](https://github.com/farmOS/farmOS-map/blob/main/LICENSE)、[package.json](https://github.com/farmOS/farmOS-map/blob/main/package.json)

**判断**：中等难度，P0。首个兼容性验证应完成“导入真实地块→拖动顶点→面积更新→保存重开→导出”，并核对坐标系和单位。

## 2. Mirador：馆藏图像并排校勘台

**仓库与用户**：[ProjectMirador/mirador](https://github.com/ProjectMirador/mirador)。适合古籍整理、博物馆数字化、档案扫描质检与修复前后图像比对人员。

**已核实能力**：浏览器多窗口图像查看器，支持缩放、平移、旋转、图像并排比较和批注显示。官方提供 npm/ES 模块及 UMD 嵌入方法，`Mirador.viewer()` 返回状态 store 与 actions。当前源码的 peerDependencies 明确允许 React/ReactDOM 18 或 19。[仓库说明](https://github.com/ProjectMirador/mirador)、[嵌入 API](https://github.com/ProjectMirador/mirador/blob/main/README.md)、[React peer 声明](https://github.com/ProjectMirador/mirador/blob/main/package.json)

**建议流程**：两份 IIIF 清单或本地扫描页 → 并排定位、放大核对、记录页码/差异 → 保存对照会话、复核清单和标注 JSON。图像显示与已有批注读取用上游；新增批注编辑、审核状态和报告导出需工作台补充，不能宣称核心包已经包含完整编目系统。

**接入与模板约束**：首选固定发布包的 ES 入口，遵循其 Emotion/MUI peer 约束，先做与模板 React 19 的单窗口渲染测试。IIIF 清单、`info.json` 及需要 fetch 的图像源通过固定同源连接器，或将受支持的本地文件构造成同源 IIIF 资源。SQLite 保存来源、选择页、窗口配置与复核记录。不要照抄 README 的 CDN 入口。

**许可与风险**：**Apache-2.0**；随发行保留许可和适用 NOTICE，修改的上游文件标明改动。馆藏影像、IIIF 清单元数据及第三方插件的授权独立于 viewer 许可证。[LICENSE](https://github.com/ProjectMirador/mirador/blob/main/LICENSE)

**判断**：中等难度，P0。首版不做远程批注写回，先验证两份真实清单、页码恢复、失效图像提示和对照记录导出。

## 3. GPX Studio：巡线、林业巡护轨迹整理台

**仓库与用户**：[gpxstudio/gpx.studio](https://github.com/gpxstudio/gpx.studio)。适用于林业巡护、供水/电力巡线、野外调查队长；这是对轨迹编辑能力的行业化组合，并非上游已经提供工单与人员考勤。

**已核实能力**：网站支持 GPX 创建编辑、轨迹裁剪/拆分/合并和导出。仓库分为独立 `gpx/` TypeScript 解析/操作库与 SvelteKit 网站；源码有 `parseGPX()`、`buildGPX()`。[README](https://github.com/gpxstudio/gpx.studio/blob/main/README.md)、[GPX I/O 源码](https://github.com/gpxstudio/gpx.studio/blob/main/gpx/src/io.ts)、[裁剪/拆分](https://gpx.studio/help/toolbar/scissors)、[合并](https://gpx.studio/help/toolbar/merge)

**建议流程**：手持 GPS/手机导出的多份 GPX → 按巡检区段裁剪、合并、修正元数据、关联现场备注 → 区段 GPX、里程统计、巡检交付包。保留原始轨迹与编辑结果，避免把人工修改后的轨迹冒充原始采集证据。

**接入与模板约束**：优先定点复用 `gpx/` 的 MIT TS 代码，在 React 中实现行业流程；该目录 `private:true`，不能把同名 npm 包 `gpx` 当成此项目安装。复制源代码仍需处理严格 TS 类型与上游变更，不复制其 SvelteKit 构建。首版使用已有轨迹和本地底图；官网使用 MapTiler key、GraphHopper 等服务，路线自动寻路和高程补全不是纯本地功能，必须单独接入。[内部包声明](https://github.com/gpxstudio/gpx.studio/blob/main/gpx/package.json)、[网站依赖说明](https://github.com/gpxstudio/gpx.studio/blob/main/README.md)

**许可与风险**：**MIT**，需保留原始版权。底图、地形数据和路由 API 条款单独处理；XML 导入要限制大小、点数并验证坐标，不能直接把解析结果当有效测量数据。[LICENSE](https://github.com/gpxstudio/gpx.studio/blob/main/LICENSE)

**判断**：中等难度，P0。首个闭环为“两段巡检轨迹→裁剪合并→重开恢复→导出并重新解析”，不承诺实时定位或自动排班。

## 4. Allmaps：古地图控制点配准台

**仓库与用户**：[allmaps/allmaps](https://github.com/allmaps/allmaps)。面向历史地理研究者、城市档案馆、地图图书馆和文物调查人员。

**已核实能力**：围绕 IIIF 数字地图进行整理、配准和探索；`@allmaps/transform` 用控制点建立坐标变换，可正向/逆向转换点、线、多边形；仓库提供 annotation、render、Leaflet/OpenLayers 等子包。[项目说明](https://github.com/allmaps/allmaps/blob/main/README.md)、[transform API](https://github.com/allmaps/allmaps/blob/main/packages/transform/README.md)

**建议流程**：历史扫描图/IIIF 图像＋对应地理控制点 → 手工配点、选择变换、叠图复核 → Georeference Annotation JSON、控制点表与可复现配准项目。自动识别控制点和学术级误差结论不计入首版。

**接入与模板约束**：优先只取 MIT 的 `transform`、`annotation` 与经验证的 Canvas/WebGL2 渲染入口，使用 React 自建配点界面，SQLite 保存控制点版本。当前整仓开发说明要求 Node 24+、pnpm 12，因此不能照搬 monorepo 到 Node 22 模板；应验证已发布子包是否能被固定构建消费。`render` 暴露独立 canvas/webgl2/wasm 入口，另有 Rust 构建的 `render-wasm` 包；**当前工作台不得采用 WASM 路径**。IIIF 和底图请求也须同源处理。[开发要求](https://github.com/allmaps/allmaps/blob/main/README.md#installation)、[render 入口](https://github.com/allmaps/allmaps/blob/main/packages/render/package.json)、[WASM 包](https://github.com/allmaps/allmaps/blob/main/packages/render-wasm/package.json)

**许可与风险**：**组件包 MIT；Editor 等应用 GPL-3.0**，不能把整个项目统一标为 MIT。项目公开配准数据标 CC0，底图标 ODbL；图像本身仍依馆藏授权。若直接复制应用代码，应按照其 GPL-3.0 分发条件处理。[transform LICENSE](https://github.com/allmaps/allmaps/blob/main/packages/transform/LICENSE.md)、[Editor LICENSE](https://github.com/allmaps/allmaps/blob/main/apps/editor/LICENSE.md)、[许可分区](https://github.com/allmaps/allmaps/blob/main/README.md#license)

**判断**：中—高难度，P1。先验证纯 JS 控制点变换及可导出的 annotation，再决定是否纳入动态影像扭曲。

## 5. GeoTIFF.js：农业/水域遥感影像检查台

**仓库与用户**：[geotiffjs/geotiff.js](https://github.com/geotiffjs/geotiff.js)。适合农技遥感分析员、无人机测绘交付人员、湿地和养殖塘区调查人员。

**已核实能力**：浏览器/Node 的 GeoTIFF 元数据与栅格读取；支持本地 ArrayBuffer/Blob、切片影像、波段选择、窗口/边界框子集及多种压缩格式。官方明确说明其不是 GDAL 那样的高层地理分析 API。[README](https://github.com/geotiffjs/geotiff.js/blob/master/README.md)

**建议流程**：正射/多光谱 GeoTIFF＋地块边界 → 检查 CRS、分辨率、波段、缺失值，抽样与限定区域统计 → 质量检查表、抽样 CSV、预览图。NDVI/NDWI 等可作为我们新增的固定公式模块，但必须确认波段定义、量纲和标定，不能说该库自带病害诊断或投饵建议。

**接入与模板约束**：React 负责视窗与检查项目；栅格原件保存为附件。首版只接收经样例验证的无压缩/LZW/Deflate 等纯 JS 路径；LZW 为 JS 实现，Deflate 使用 pako。Pool 可设 0 在主线程解码，但大文件需限制窗口与像素数；若使用 Worker，要将其作为同源静态资源。[LZW 源码](https://github.com/geotiffjs/geotiff.js/blob/master/src/compression/lzw.js)、[Deflate 源码](https://github.com/geotiffjs/geotiff.js/blob/master/src/compression/deflate.js)、[Pool 参数](https://github.com/geotiffjs/geotiff.js/blob/master/src/pool.js)

**许可与风险**：**MIT**。LERC/Zstandard 依赖另外的解码器，不可根据“JavaScript 库”这一描述就推断全部路径无 WASM；这些格式须作为当前 CSP 下的阻塞项单独验证，未通过前明确拒绝。GDAL 命令行转换、原生处理不纳入工作台内执行；用户可在外部预处理后导入。[LICENSE](https://github.com/geotiffjs/geotiff.js/blob/master/LICENSE)、[依赖声明](https://github.com/geotiffjs/geotiff.js/blob/master/package.json)、[LERC 解码路径](https://github.com/geotiffjs/geotiff.js/blob/master/src/compression/lerc.js)、[Zstd 解码路径](https://github.com/geotiffjs/geotiff.js/blob/master/src/compression/zstd.js)

**判断**：中等难度，P1。第一版应叫“影像检查”，以可解释的输入质量与抽样输出建立价值。

## 6. farmOS.js：牲畜批次、转场与观察日志台

**仓库与用户**：[farmOS/farmOS.js](https://github.com/farmOS/farmOS.js)。面向牧场记录员、农业试验站、需要离线记录后同步的现场人员。

**已核实能力**：提供农场领域模型的创建、更新、合并以及远程收发方法，以服务器 JSON Schema 驱动数据结构，支持离线场景和 Last-Write-Wins 合并。其官方领域模型包含 Animal、Land、Water 等 Asset，以及活动/投入/观察等 Log；farmOS 文档说明动物可按个体或群体记录，转场通过 Log 建立关系。[farmOS.js 文档](https://github.com/farmOS/farmOS.js/blob/main/docs/index.md)、[实体 API](https://farmos.org/development/farmos-js/entities/)、[动物与群组](https://farmos.org/guide/assets/)

**建议流程**：经核对的资产/日志 schema＋牲畜名单或批次表 → 登记转场、盘点变化和观察记录，展示冲突与待审核条目 → 本地时间线、CSV/JSON 台账，以及人工确认后的同步队列。它是 SDK，不是现成的兽医管理或养殖优化算法。

**接入与模板约束**：本地模式用 JS 模型配 React 表单，SQLite 存资产、日志与版本；若连接 farmOS，经 Node 固定服务连接器处理认证和 API，浏览器只访问同源。farmOS 主服务是 PHP/Drupal 系统，属于外部既有系统，不能直接移入模板。SDK 文档仍标实验性 2.x beta、声明兼容 farmOS 2.x 数据模型，不能假设自动支持当前所有服务端版本；对同步冲突必须让用户检查，不能把 LWW 当作不会丢数据的保证。[实验性及兼容说明](https://github.com/farmOS/farmOS.js/blob/main/docs/index.md)、[farmOS 服务端仓库](https://github.com/farmOS/farmOS)

**许可与风险**：当前 `LICENSE` 与 `package.json` 为 **MIT**，但 README 徽章仍写 GPL 3.0，这是已发现的上游文档不一致。按选定版本的实际 LICENSE 与发行包核对，不能只读徽章；farmOS 主服务许可另行处理。SDK 当前源码包仍含较旧依赖范围，实施前需选定与审查依赖版本。[LICENSE](https://github.com/farmOS/farmOS.js/blob/main/LICENSE)、[package.json](https://github.com/farmOS/farmOS.js/blob/main/package.json)、[有冲突徽章的 README](https://github.com/farmOS/farmOS.js/blob/main/README.md)

**判断**：中—高难度，P1。优先离线台账与 JSON 导出，取得真实目标 farmOS 版本及 schema 后再做双向同步。

## 7. Potree：测绘点云剖面与现场标注台

**仓库与用户**：[potree/potree](https://github.com/potree/potree)。面向测绘质检、林业点云调查、文物三维采集、采石场或设施现场复核人员。

**已核实能力**：WebGL 大规模点云查看器，官方示例包含剖面、测量、分类、裁剪体和标注。官方工作流通常先用独立 PotreeConverter 转换原始 LAS，再将转换结果、viewer 与静态文件一起托管。[README 与示例](https://github.com/potree/potree)

**建议流程**：**已转换的受支持点云目录**＋测绘说明 → 分类查看、剖面检查、测量与问题点标注 → 检查项目 JSON、测量清单与截图。体积估算、坐标校正、精度合格判定需另行定义方法，不能仅凭 viewer 就宣称具有完整测绘分析能力。

**接入与模板约束**：使用经过固定的官方静态发行物与同源 Worker，不照搬 Gulp 构建。当前 repo `private:true`，不能假设存在可直接用的官方 npm 组件。原始点云转换器需在外部预处理，或接独立转换服务；不得把其原生二进制打包执行。WorkerPool 使用 URL Worker，可研究同源部署，但各压缩解码分支仍需逐一检查 CSP，首版限制已验证格式，不能承诺拖入任意 LAS/LAZ 就工作。[package.json](https://github.com/potree/potree/blob/develop/package.json)、[WorkerPool](https://github.com/potree/potree/blob/develop/src/WorkerPool.js)、[Zstandard 分支](https://github.com/potree/potree/blob/develop/src/workers/EptZstandardDecoderWorker.js)

**许可与风险**：核心 **BSD-2-Clause**。仓库附带的第三方库和资源有各自许可证，`resources/LICENSE` 包含需要归属说明的素材，不能只保留顶层 BSD 文本就复制全部资源。[核心 LICENSE](https://github.com/potree/potree/blob/develop/LICENSE)、[资源 LICENSE](https://github.com/potree/potree/blob/develop/resources/LICENSE)

**判断**：高难度，P2。只有已有标准点云交付物的用户才适合优先做；否则转换流程会比工作台本身更重。

## 8. VROOM：冷链配送与上门服务多车排线台

**仓库与用户**：[VROOM-Project/vroom](https://github.com/VROOM-Project/vroom)，官方演示前端为 [vroom-frontend](https://github.com/VROOM-Project/vroom-frontend)。面向水产/生鲜配送调度员、农业服务车队、专业上门维保排班人员。

**已核实能力**：C++ 路线优化引擎；JSON 输入包括车辆、任务、取送货、容量、技能和时间窗，输出分配路线与相关结果。支持 OSRM、Openrouteservice、Valhalla 或自定义成本矩阵。前端 README 明确要求运行中的 OSRM、VROOM、vroom-express，并非只有浏览器代码即可完成优化。[引擎 README](https://github.com/VROOM-Project/vroom/blob/master/README.md)、[JSON API](https://github.com/VROOM-Project/vroom/blob/master/docs/API.md)、[前端运行要求](https://github.com/VROOM-Project/vroom-frontend/blob/master/README.md)

**建议流程**：订单 CSV＋车辆容量/班次＋客户时间窗 → 地址/坐标校验、人工修订约束、调用优化服务、检查未分配任务 → 车辆任务单、顺序/预计到达表、可重新编辑的方案。产品定位为排线决策辅助；VROOM 不自动验证冷链温控、动物运输规范或现实道路可通行性。

**接入与模板约束**：**外部服务接入型**。React 实现行业约束编辑器，Node 同源 API 调用固定的 VROOM 服务，SQLite 保存输入快照、响应与人工调整；C++ 求解器和路网引擎必须在外部部署。不要承诺在工作台内用 npm 安装 vroom-express 后即可运行求解。无路网服务时可以提交自定义矩阵，但矩阵的取得和质量仍由调用方负责。

**许可与风险**：VROOM 与官方前端均为 **BSD-2-Clause**。所选路由引擎、地理编码、路网数据与商业服务可能有额外许可/费用；演示服务器不是生产可用性承诺。[引擎 LICENSE](https://github.com/VROOM-Project/vroom/blob/master/LICENSE)、[前端 LICENSE](https://github.com/VROOM-Project/vroom-frontend/blob/master/LICENSE)

**判断**：高难度，P2；如果用户已有 VROOM/路由 API，可提升到 P1。首个验收必须包含无法分配的任务及明确原因，不能只展示一张好看的路线图。

## 9. Signal K InstrumentPanel：船舶机舱/航行仪表巡检台

**仓库与用户**：[SignalK/instrumentpanel](https://github.com/SignalK/instrumentpanel)。面向小型船队、渔船机务、游艇维护人员，定位为船舶数据复核与维护记录，不作为新的主导航设备。

**已核实能力**：可拖放/缩放的船舶仪表网格，按收到的 Signal K path 动态生成部件；官方帮助包含航行、环境、电气/推进数据、风向组合仪表、单位选择、告警页面，以及布局 JSON 保存/读取。它通过 WebSocket 连接 Signal K 服务。[README](https://github.com/SignalK/instrumentpanel/blob/master/README.md)、[官方使用说明](https://github.com/SignalK/instrumentpanel/blob/master/lib/help/help.md)

**建议流程**：既有 Signal K 数据流或导出的样本 → 选定设备/参数、显示最新值与采集时间、记录异常和维护备注 → 交班检查表、异常片段、仪表布局 JSON。历史片段、SQLite 留存和交班报告是需要补充的工作台功能，上游布局导出不等于已经支持这些业务。

**接入与模板约束**：**外部船舶数据服务接入型**；首版可只读订阅。其前端依赖 React 16.12 与旧 react-bootstrap，不能直接作为 React 19 组件混装；可研究官方预构建 bundle 的同源独立文档，并对状态桥接做 origin/source 校验。跨源 WebSocket 被 `connect-src self` 阻止，需要固定 Node 连接器，再通过模板支持的同源传输方式转发；是否支持 WebSocket upgrade 需要另验，不能假设模板具备。NMEA/串口/CAN 采集由既有 Signal K 服务处理，不引入原生设备驱动。[依赖版本](https://github.com/SignalK/instrumentpanel/blob/master/package.json)、[连接配置](https://github.com/SignalK/instrumentpanel/blob/master/README.md#for-developers)

**许可与风险**：**Apache-2.0**。保留许可/适用声明；把“数据过期、连接断开、单位、采集时间”作为产品状态，不能把冻结的旧值显示成当前正常状态。是否可获得真实船舶测试数据是选型前置条件。[LICENSE](https://github.com/SignalK/instrumentpanel/blob/master/LICENSE)

**判断**：高难度，P2。先做样本数据的只读复核；有现成 Signal K 服务后再考虑实时接入。

## 本轮边界与实施顺序

这 9 个候选中，直接复用的主要是空间编辑、标准文件解析和行业数据展示能力。水产部分能扎实覆盖塘口边界、影像检查、冷链配送和渔船设备记录；本轮没有找到证据足够、可在当前模板直接嵌入的完整投饵优化/水质控制 JS 系统，因此未用通用仪表盘或未核验算法补数。

建议先用真实样例各做一个小闭环：farmOS-map 的边界修改与导出、Mirador 的双文献对照恢复、GPX 的轨迹切分重组。再分别验证 Allmaps 的纯 JS 配准入口、GeoTIFF 的具体压缩格式和 farmOS.js 的目标 schema。Potree、VROOM、Signal K 在具备数据/外部服务后进入实施。所有阶段都应验证原始文件保留、未保存修改保护、错误恢复、导出可再导入，以及当前 CSP 下真实网络/Worker 行为。
