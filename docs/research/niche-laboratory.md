# 实验室、科研与专业影像工作台候选

核验日期：**2026-10-27**。精选 **9 项**；只读调研，未安装或运行候选、未修改现有应用、未提交，也未更新 catalog。功能和许可依据官方 README、源码、LICENSE、包清单与官方 API 文档；优先级和工作台流程是本次工程评估，**不代表已适配成功**。主分支 package.json 中的版本仅是源码观察点，不自动视为推荐安装的稳定发布。

建议先验证 **SeqViz、OpenChemLib JS、3Dmol.js**：三者有明确的专业数据模型和浏览器接口，能围绕“样本资料 → 人工核对/标注 → 可恢复项目与导出”形成工作台。其余项目按专业文件、渲染资源或许可复杂度递进。

## 适配前提

- 模板固定 Node 22、React 19.2.3、SQLite、严格 TypeScript 与 Vite。选择发布包的浏览器入口或可复现的同源静态 bundle，不直接移植上游开发服务器，不添加原生二进制或自定义 Vite 插件。
- 当前 CSP 为 `script-src 'self'`、`connect-src 'self'`；worker/font 未单列时继承 self。远程参考数据、CDN 脚本、Google Fonts、blob worker 均不能按上游在线示例照搬。优先本地文件与同源资源；需要外部数据时另做受限的服务端读取，不把浏览器直连当成默认能力。
- **WASM 是明确关卡**：主线程在官方锁定模板中对空 WASM 模块实测已被 CSP 拦截，缺少 `wasm-unsafe-eval`。同源下载 .wasm 并不能解决编译权限。未改变平台能力前，不承诺 WASM 编解码器可用。证据：[模板 CSP 探针](template-csp-probe.json)。
- SQLite 保存样本元数据、标注、处理参数、资源标识和版本。大图像、基因组索引、原始谱数据应使用独立资源保存及按需读取，不把它们塞入现有 900 KB projects JSON 字段。重新打开项目必须能找回原文件，不能只保存失效的 File/blob URL。
- 涉及医学的 NiiVue、DWV，以及基因组浏览均定位为研究资料查看、标注和质量核对；不提供诊断结论。首轮使用公开、合成或已去标识化样本。
- 本文核实的是列明版本/文件的许可；没有完成各候选整个传递依赖树的分发审计。进入实施时仍需锁版并保留第三方声明。

## 候选一览

P1＝优先做最小集成验证；P2＝第二批，需限定文件/规模或处理旧依赖；P3＝先解决许可及部署边界。难度按“能保存恢复、真实导出、错误可见”的小型工作台估计，不含仪器联机、临床认证或自动科研推断。

| 项目 | 行业用户与工作台定位 | 根项目许可 | 难度 / 优先级 |
| --- | --- | --- | --- |
| [SeqViz](https://github.com/Lattice-Automation/seqviz) | 分子生物学：质粒与序列审阅台 | MIT | 低–中 / P1 |
| [OpenChemLib JS](https://github.com/cheminfo/openchemlib-js) | 合成化学：结构登记与分子比对台 | BSD-3-Clause | 中 / P1 |
| [3Dmol.js](https://github.com/3dmol/3Dmol.js) | 结构生物学：分子结构讲解与标注台 | BSD-3-Clause，含第三方声明 | 中 / P1 |
| [Lorikeet](https://github.com/UWPR/Lorikeet) | 蛋白质组学：肽段 MS/MS 谱核对台 | MIT | 中 / P2 |
| [igv.js](https://github.com/igvteam/igv.js) | 生信研究：局部基因组证据审阅台 | MIT | 中–高 / P2 |
| [GeoTIFF.js](https://github.com/geotiffjs/geotiff.js) | 地学/遥感：栅格与高程文件检查台 | MIT | 中 / P2 |
| [NiiVue](https://github.com/niivue/niivue) | 神经影像研究：体数据与分区标注台 | BSD-2-Clause | 中–高 / P2 |
| [Viv](https://github.com/hms-dbmi/viv) | 显微成像：多通道切片审阅台 | MIT | 高 / P2 |
| [DWV](https://github.com/ivmartel/dwv) | 医学影像研究：DICOM 文件检查与测量台 | GPL-3.0（项目声明） | 中–高 / P3 |

## 1. SeqViz：质粒、DNA/RNA/蛋白序列审阅

**已核实能力。** 线性/环形序列视图，注释、引物、氨基酸翻译、酶切位点、允许错配的搜索，以及选区回调。它是查看器，不能把这些功能说成完整序列编辑或实验设计系统。[README](https://github.com/Lattice-Automation/seqviz/blob/develop/README.md)

**工作台建议。** 输入本地 FASTA/GenBank 或序列文本 → 核对特征区间、方向、引物与酶切位置，记录审阅意见 → 输出选区序列、标注 JSON/CSV 和可恢复项目。首轮可从纯序列文本与显式 annotations 开始；复杂格式由单独解析层负责，导出表由工作台实现。

**接口与模板边界。** React `<SeqViz seq={...} annotations={...} onSelection={...}/>`，也有非 React Viewer API。上游建议把已弃用的 `file/accession` 解析移到 `seqparse`；坐标为 0-based、起点包含/终点不包含，必须在 GenBank 转换和导出中保持一致。当前源码清单为 3.10.25，peer 明确包含 React 19。必须设置 `disableExternalFonts` 并同源提供所需等宽字体；源码默认会请求 Google Fonts。远程 accession 查询不能在当前 connect-src 下直接使用。[包清单](https://github.com/Lattice-Automation/seqviz/blob/develop/package.json)、[字体及选区源码](https://github.com/Lattice-Automation/seqviz/blob/develop/src/SeqViz.tsx)

**许可与风险。** MIT。文件解析器的独立许可与恶意/超长序列边界仍需锁版检查；先限制为质粒/短序列，不宣称可流畅处理整条人类染色体。[LICENSE](https://github.com/Lattice-Automation/seqviz/blob/develop/LICENSE)

**难度 / 优先级：低–中 / P1。核验：2026-10-27。** 最小验证应覆盖环形跨原点注释、反向特征、坐标往返与关闭外部字体后的完整加载。

## 2. OpenChemLib JS：化学结构登记与比对

**已核实能力。** OpenChemLib 的 JavaScript 移植；官方 API 包含 Molecule、Reaction、SMILES 解析、子结构搜索及 CanvasEditor。CanvasEditor 有明确的 set/get、onChange 与 destroy 生命周期。[README](https://github.com/cheminfo/openchemlib-js/blob/main/README.md)、[API 索引](https://cheminfo.github.io/openchemlib-js/modules.html)、[CanvasEditor](https://cheminfo.github.io/openchemlib-js/classes/CanvasEditor.html)

**工作台建议。** 输入 SMILES/Molfile 或在画布中绘制结构 → 核对原子、键、立体信息与分子标识，建立样本记录并比较子结构 → 输出标准结构文本、二维 SVG 与登记表。这里的“比对记录/版本/批量导出”由工作台补齐；不把结构库的预测类接口包装成经过验证的实验结论。

**接口与模板边界。** 在 React 容器 ref 中创建 `new CanvasEditor(element, options)`，用 `setMolecule/getMolecule` 和变更监听维护受控记录，卸载调用 `destroy()`。优先使用 npm 已编译 JS 与类型声明，避免引入 Java/GWT 工具链。上游当前开发构建文档测试的是 JDK 25、GWT 2.13.1、Node 26；这不等于发布 JS 运行时必须 Node 26，也不表示模板 Node 22 已验收。[构建说明](https://github.com/cheminfo/openchemlib-js/blob/main/README.md)、[发布入口](https://github.com/cheminfo/openchemlib-js/blob/main/package.json)

**许可与风险。** BSD-3-Clause，保留版权/许可与不背书条款。结构规范化可能改变等价表示；必须用芳香性、立体异构、盐及空结构样本核对往返，不能以字符串相同替代化学一致性。[LICENSE](https://github.com/cheminfo/openchemlib-js/blob/main/LICENSE)

**难度 / 优先级：中 / P1。核验：2026-10-27。** 最小范围是一个分子编辑器、结构格式往返、保存恢复；反应枚举与构象优化放后续。

## 3. 3Dmol.js：三维分子结构标注

**已核实能力。** WebGL 分子显示，支持 PDB、SDF、MOL2、XYZ、CIF、CUBE 等专业格式；原子筛选、cartoon/stick/surface 样式、标签和点击交互。GLViewer 提供 PNG 图像输出。[README](https://github.com/3dmol/3Dmol.js/blob/master/README.md)、[GLViewer API](https://3dmol.org/doc/GLViewer.html)

**工作台建议。** 输入本地结构文件 → 按链/残基/原子选择并着色、标记关注区域、保存相机视角与说明 → 输出 PNG、选区清单与场景 JSON。适合结构教学、实验组会及已有结构结果的人工审阅；不包含 docking、能量计算或结构预测。

**接口与模板边界。** `createViewer(container)` → `addModel(text, format)` → `setStyle/zoomTo/render`；截图用 `pngURI()`。不用示例里的远程 PDB 下载，先接受用户本地文件。表面默认有并行计算路径，先关闭表面或使用 `setSyncSurface(true)`；同源 worker 改造需单独验收。只传真实函数回调：源码对“字符串回调”使用 eval，会被现有 CSP 拒绝。[同步表面 API](https://3dmol.org/doc/global.html#setSyncSurface)、[字符串回调源码](https://github.com/3dmol/3Dmol.js/blob/master/src/utilities.ts)

**许可与风险。** 主体 BSD-3-Clause；LICENSE 同时保留 GLmol、Three.js、jQuery 的第三方声明，不能只复制一行 SPDX。大模型/表面会增加 GPU 和内存开销；研究文件中的坐标单位与缺失原子也要原样提示。[完整 LICENSE](https://github.com/3dmol/3Dmol.js/blob/master/LICENSE)

**难度 / 优先级：中 / P1。核验：2026-10-27。** 先做无 surface 的 PDB/SDF 查看与 PNG 导出，验证 GPU 失败状态、资源释放及断网加载。

## 4. Lorikeet：肽段 MS/MS 谱核对

**已核实能力。** jQuery 谱图插件，用肽段序列与 m/z–强度数组显示带碎片离子注释的 MS/MS 谱；可选择离子类型、缩放，附加 MS1 谱、前体峰、修饰和质量误差参数。[README](https://github.com/UWPR/Lorikeet/blob/master/README)、[specview 源码](https://github.com/UWPR/Lorikeet/blob/master/js/specview.js)

**工作台建议。** 输入已导出的峰列表 CSV/JSON、肽段序列、电荷和修饰信息 → 人工核对 b/y 等离子匹配、误差和前体峰，添加审阅意见 → 输出核对表、峰列表、参数 JSON 与截图。库核心输入是数组；MGF、mzML 或仪器 RAW 的解析不是该插件已验证的能力，不列入首版。

**接口与模板边界。** 同源 vendored JS/CSS 后在独立 DOM 区域调用 `$(element).specview(options)`。外层 React 19 只管理容器与数据，不让 jQuery 和 React 同时改同一子树。需要把上游示例的内联初始化脚本改为编译入口代码；核心计算不要求原生模块。SQLite 保存峰数据索引、修饰参数和审阅版本。

**许可与风险。** 根项目 MIT。README 明确依赖修改版 Flot、jQuery 和 jQuery UI，需要保留对应声明并核查旧依赖。GitHub API 返回最后 push 为 2023-09-07，未归档；这只是源码活跃度证据，不应描述成持续维护。对文件名、注释文本做安全显示，不能直接信任旧插件的 HTML 拼接。[LICENSE](https://github.com/UWPR/Lorikeet/blob/master/LICENSE)、[仓库元数据](https://api.github.com/repos/UWPR/Lorikeet)

**难度 / 优先级：中 / P2。核验：2026-10-27。** 行业任务很明确，但旧 UI 依赖使它排在前三个 JS 项目之后。

## 5. igv.js：基因组局部证据审阅

**已核实能力。** 可嵌入的基因组浏览器；轨道包括 BED/GFF/GTF 注释、bigWig、BAM/CRAM 比对、VCF 变异等。官方浏览器 API 支持 ROI、会话 JSON 和 SVG 导出。[README](https://github.com/igvteam/igv.js/blob/master/README.md)、[轨道类型](https://igv.org/doc/igvjs/tracks/Tracks/)、[Browser API](https://igv.org/doc/igvjs/Browser-API/)

**工作台建议。** 输入参考序列/索引及若干本地轨道 → 定位染色体区间、并排检查注释/覆盖度/变异证据、记录 ROI 和审阅意见 → 输出会话 JSON、SVG 和 ROI 表。用途是已有测序结果的研究审阅，不做 read alignment、variant calling 或临床解释。

**接口与模板边界。** `igv.createBrowser(div, config)`、`loadTrack`、`search`、`toJSON`、`toSVG`。React 19 作为外层 DOM 包装即可；主要风险是数据访问而非 React 绑定。内置 genome 名称和基因名搜索通常依赖远程资源，不能直接使用示例 hg38 配置；要显式配置同源 reference、索引、轨道，并提供按字节范围读取。先用小范围 FASTA + BED/VCF，BAM/CRAM 编解码及大文件另验；仅保存会话 JSON 不会自动把外部轨道数据带进项目。[参考/会话与搜索说明](https://igv.org/doc/igvjs/Browser-API/)、[索引读取要求](https://igv.org/doc/igvjs/tracks/Tracks/)

**许可与风险。** MIT。原始数据、参考基因组和注释集各有来源许可；不能把软件 MIT 延伸为数据授权。必须显示参考版本与染色体命名，避免同名区间跨版本误读。[LICENSE](https://github.com/igvteam/igv.js/blob/master/LICENSE)

**难度 / 优先级：中–高 / P2。核验：2026-10-27。** 需要先完成可恢复的文件/索引资源管理，再扩大数据规模。

## 6. GeoTIFF.js：遥感与高程栅格检查

**已核实能力。** 从本地 ArrayBuffer/File/Blob 或远程数据读取 GeoTIFF 元数据、栅格、波段、窗口、包围盒与概览层；有可选 worker 池。它是文件解码库，不是 GDAL 的完整重投影/地理处理替代品。[README](https://github.com/geotiffjs/geotiff.js/blob/master/README.md)

**工作台建议。** 输入无人机正射影像、DEM 或多波段 GeoTIFF → 检查 CRS/范围/分辨率/NoData，选择波段与窗口，采样高程或对比像素 → 输出元数据报告、采样 CSV、预览 PNG 与参数项目。坐标变换/波段运算由工作台显式实现并验证，不夸称上游已有完整 GIS 分析。

**接口与模板边界。** `fromBlob/fromArrayBuffer` → `getImage` → `readRasters`，限制 window/width/height。选择浏览器入口，避免 Node fs 入口被模板拒绝；默认先不用 worker 池。源码把压缩解码器分派到独立模块，LERC/Zstandard 会调用额外解码依赖；不能把“GeoTIFF 支持”视为任意编码都能通过 CSP。首版明确仅接受已验证的未压缩、LZW 或 Deflate 样本；其他编码返回具体错误。[包入口与依赖](https://github.com/geotiffjs/geotiff.js/blob/master/package.json)、[解码分派](https://github.com/geotiffjs/geotiff.js/blob/master/src/compression/index.js)、[LERC](https://github.com/geotiffjs/geotiff.js/blob/master/src/compression/lerc.js)、[Zstandard](https://github.com/geotiffjs/geotiff.js/blob/master/src/compression/zstd.js)

**许可与风险。** MIT；额外解码器独立核查。像素值、NoData、轴方向和坐标系不能靠预览猜测；未经确认的投影只展示原始参数，不自动标成经纬度。[LICENSE](https://github.com/geotiffjs/geotiff.js/blob/master/LICENSE)

**难度 / 优先级：中 / P2。核验：2026-10-27。** 小型文件检查台可控，全分辨率大地理数据浏览则明显更复杂。

## 7. NiiVue：神经影像研究资料查看

**已核实能力。** WebGL2 体数据/网格查看，原生支持 NIfTI 等多种神经影像格式，提供布局、切片、色表和绘制接口。官方明确：DICOM、MINC、TIFF 的额外支持来自插件，不能与基本 NIfTI 支持混为一谈。[README](https://github.com/niivue/niivue/blob/main/README.md)、[Niivue API](https://niivue.com/docs/api/niivue/classes/Niivue/)

**工作台建议。** 输入本地 NIfTI 与已有分区/覆盖图 → 三向切片及体显示，调整色表/阈值，保存研究标注和查看状态 → 输出截图、研究备注和可恢复会话。首版只做资料查看与标注，不接自动病灶判别或 DICOM 转换。

**接口与模板边界。** 在 canvas 上绑定 Niivue 实例，按官方 API 加载体数据；外层无需依赖其 React 组件。现有仓库清单观察为 0.69.0，原生 NIfTI 路径依赖 JS 解压与 reader；但 package.json 有 Linux Rollup 原生 optionalDependency，工作台锁版时需移除无关运行条目并验证。字体/atlas 等资源需同源；插件若引入 WASM，即受本文 CSP 硬限制。[package.json](https://github.com/niivue/niivue/blob/main/packages/niivue/package.json)

**许可与风险。** BSD-2-Clause。项目正迁移到 [niivue/mono](https://github.com/niivue/mono)，现有仓库维护过渡期、版本保持低于 1.0，新 monorepo 将走 1.0 候选版；不能无说明追 main 或混用两套 API。进入实施需先明确稳定版本和迁移路线。空间方向、体素间距、覆盖图是否同空间必须显示并验证。[迁移公告](https://github.com/niivue/niivue/blob/main/README.md)、[LICENSE](https://github.com/niivue/niivue/blob/main/LICENSE)

**难度 / 优先级：中–高 / P2。核验：2026-10-27。** 以 NIfTI 小样本为第一关，DICOM/计算插件不承诺同批交付。

## 8. Viv：多通道显微切片审阅

**已核实能力。** WebGL 显微图像工具包，浏览器直接呈现 OME-TIFF、OME-NGFF/Zarr 与 Indexed OME-TIFF，使用 deck.gl 层组织多尺度、多通道图像。官方建议专有仪器格式先用外部管线转换；非金字塔图像有 GPU 纹理尺寸限制。[README](https://github.com/hms-dbmi/viv/blob/main/README.md)

**工作台建议。** 输入已转换的 OME-TIFF 或同源 OME-Zarr 资源 → 切换通道、颜色、Z/T 平面和可见范围，标记感兴趣区及检查意见 → 输出截图、ROI 清单和通道/视图配置。不是细胞检测或定量分割工具；仪器原始格式转换不放入无原生依赖的模板。

**接口与模板边界。** 用 Viv loader 与 deck.gl 渲染层/查看器组合；当前仓库分为 @vivjs/loaders、@vivjs/viewers 等包。工作区 React catalog 包含 19，但发布包实际 peer 仍需逐包锁定核对，不能把 workspace:* / catalog: 原样搬入应用。OME-TIFF 的 GeoTIFF 解码与 Zarr codec 决定是否涉及 worker/WASM；首版仅接受确认过的纯 JS 压缩路径。大资源通过同源分块/范围读取，别整图写进 SQLite JSON。[loaders 依赖](https://github.com/hms-dbmi/viv/blob/main/packages/loaders/package.json)、[viewers peer](https://github.com/hms-dbmi/viv/blob/main/packages/viewers/package.json)、[工作区版本目录](https://github.com/hms-dbmi/viv/blob/main/pnpm-workspace.yaml)

**许可与风险。** MIT。源数据的多维轴、通道标签、像素物理尺寸、金字塔级别必须保留；否则“显示出一张图”不等于正确读取实验数据。[LICENSE](https://github.com/hms-dbmi/viv/blob/main/LICENSE)

**难度 / 优先级：高 / P2。核验：2026-10-27。** 专业价值高，但文件资产和 codec 矩阵应先于界面投入验证。

## 9. DWV：DICOM 研究文件检查与测量

**已核实能力。** DICOM Web Viewer 的浏览器库，支持本地/远程 DICOM、序列滚动、对比度、缩放、平移、MPR、标注和部分滤镜。项目自己明确未获诊断用途认证；本工作台也只建议研究/教学资料查看。[README](https://github.com/ivmartel/dwv/blob/develop/readme.md)

**工作台建议。** 输入去标识化 DICOM 文件集 → 检查 series/instance 与 transfer syntax，浏览窗宽窗位、做研究测量和注释 → 输出测量表、截图与研究会话。首版不连接 PACS、不做 DICOM 匿名化保证，也不把修改后的截图说成新的合规 DICOM。

**接口与模板边界。** 使用浏览器包的 App 初始化/加载及事件 API，外层 React 管理文件与项目。Node 版本声明 >=14 覆盖 22，但 develop 当前清单是 0.37.0-beta.19，不能直接当稳定安装基线。已查 decoder 源码：JPEG baseline/lossless/JPEG2000/RLE 使用相对 URL 的 JS worker，不能一概标成 WASM；须确认发布 bundle 里的 worker 文件完整同源输出。先验证未压缩 DICOM，再按传输语法逐项增加，不承诺全部 DICOM。[包入口](https://github.com/ivmartel/dwv/blob/develop/package.json)、[decoder worker 源码](https://github.com/ivmartel/dwv/blob/develop/src/image/decoder.js)、[官方一致性表](https://github.com/ivmartel/dwv/blob/develop/resources/doc/tutorials/conformance.md)

**许可与风险。** 根项目声明 **GPL-3.0**，不是 MIT/LGPL。分发衍生工作台前需要选择与 GPL 相容的项目许可和对应源码分发方案，不能沿用“全部应用 MIT”的假设。内置 PDF.js 衍生解码代码另有 Apache-2.0 声明且来自较旧版本，应保留其说明并做样本回归。原生 canvas 出现在开发依赖中，应用只取浏览器发布物。[GPL 文本](https://github.com/ivmartel/dwv/blob/develop/license.txt)、[解码器来源](https://github.com/ivmartel/dwv/blob/develop/src/decoders/pdfjs/readme.md)

**难度 / 优先级：中–高 / P3。核验：2026-10-27。** 许可方案和稳定发布选择明确后再实施。

## 已核实但不列入本轮九项的候选

### NMRium：不能只看根仓库 MIT

NMRium 是真正的 NMR 显示/处理 React 组件，根 [LICENSE](https://github.com/cheminfo/nmrium/blob/main/LICENSE) 为 MIT。但本次检查的当前 [package.json](https://github.com/cheminfo/nmrium/blob/main/package.json)（源码版本 3.1.0）依赖 `@zakodium/nmrium-core ^0.7.80` 和 `@zakodium/nmrium-core-plugins ^0.7.115`，peer React/React DOM 为 `^19.3.0`，高于本模板 19.2.3。

**具体许可证据：** 2026-10-27 直接读取维护者发布的 npm registry，`@zakodium/nmrium-core@0.7.81` 声明 `CC-BY-NC-SA-4.0`；因此“根仓库 MIT”不能代表所选安装依赖链允许同样使用。本次没有取得整个 plugins 依赖树的许可结论，不能自行推定它与根仓库相同。[该版本包元数据](https://registry.npmjs.org/@zakodium/nmrium-core/0.7.81)

同日核查的 `jcampconverter@12.5.11` 发布元数据也声明 `CC-BY-NC-SA-4.0`，所以没有把旧印象中的 MIT JCAMP 工具作为替代优先项。[该版本元数据](https://registry.npmjs.org/jcampconverter/12.5.11)

这是对**当前明确版本**的限制说明，不否定历史 MIT 版本；若考虑历史版本，需要另查对应 tarball、完整依赖、功能差异和维护成本。当前商业/公开工作台批量化路线先选 MIT 的 Lorikeet 作为质谱审阅方向。

### JS9：维护与平台双重关卡

JS9 支持 FITS 图像、数据立方体和区域标注，根许可为 MIT；但 README 明确说明 2022 年结束积极开发、2024 年 v3.9 后为归档状态准备，并提醒没有维护者。其 FITS 处理使用 WASM，当前模板已实测不允许；大文件/helper 还涉及额外原生依赖。不将其作为本轮可直接改造项目。[README](https://github.com/ericmandel/js9/blob/master/README.md)、[LICENSE](https://github.com/ericmandel/js9/blob/master/LICENSE)

### Open Vector Editor：需要真正编辑时的备选

[TeselaGen/tg-oss 的 OVE](https://github.com/TeselaGen/tg-oss/tree/master/packages/ove) 比 SeqViz 更接近完整序列编辑器；根许可 MIT，官方有 universal `createVectorEditor/updateEditor/getState` 接口及构建 CSS。当前 [包清单](https://github.com/TeselaGen/tg-oss/blob/master/packages/ove/package.json) 依赖 React 18.3、Blueprint 3 和 monorepo file: 包，直接与 React 19 混装风险较高；可另评估同源 universal bundle 隔离方案。现阶段以更清晰的 SeqViz“审阅而非编辑”范围先落地。[嵌入说明](https://github.com/TeselaGen/tg-oss/blob/master/packages/ove/README.md)、[MIT LICENSE](https://github.com/TeselaGen/tg-oss/blob/master/LICENSE)

## 下一步验证顺序

1. **SeqViz**：关闭外部字体，文本/GenBank 解析边界与环形注释坐标往返，保存后重新打开。
2. **OpenChemLib JS**：已编译包在固定构建中的导入、CanvasEditor 生命周期、SMILES/Molfile/SVG 往返。
3. **3Dmol.js**：纯本地 PDB/SDF、真实函数回调、无表面模式、PNG 导出与 GPU 释放。
4. **再选一个文件密集方向**：IGV 的本地参考/索引，或 GeoTIFF 的限定压缩窗口读取；先证明持久化资源方案。
5. Viv/NiiVue/DWV 分别做 codec、版本迁移、许可与 worker 文件专项验证，未过关前不进入批量实现状态。

以上没有进行候选构建/浏览器验收，也没有宣称它们能在现有模板中开箱即用。每项真实实现仍需通过固定模板 check/test、离线同源加载、保存恢复、实际导出和尺寸/格式错误分支。
