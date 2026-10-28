# X 新候选：模型动画、数据分析与研究工具

检索日期：2026-10-28（America/New_York）。本轮6个项目均不在当前72项目录中；对既有 docs/research 笔记也做了名称去重。仅研究，没有安装、运行、转化或确认 Floatboat 客户端兼容性。

**优先做 Mesh2Motion 的资源兼容预研；已有 Python 服务条件时，Data Formulator 和 Scrapling 更容易做出实用闭环。OpenBB 适合作为金融研究方向，需先选定实际可用的数据源。** Blockbench 和 marimo 值得保留，但整站移植成本明显更高。

## X 证据与时效

本轮尝试了 site:x.com、site:twitter.com 及项目名检索。X 网页直接读取出现403；对下列6个具体帖子，改用官方公开 oEmbed 接口核实作者、日期和可取得的正文。该接口不提供统一互动数，一些长帖只返回截断正文。因此这里只说明“确有X讨论/展示”，不称实时热榜，也不采用二手聚合页的点赞、浏览或星数排名。

| 项目 | 可核对的X原帖 | 作者关系、日期与证据边界 |
| --- | --- | --- |
| Mesh2Motion | [Scott Petrovic](https://x.com/scottpetrovic/status/2100562741626880208) | 项目作者，2026-09-17；介绍正在实验加入动作捕捉数据。不能据此把实验功能当正式完整能力。 |
| Blockbench | [Polyjo 的 The Blubber](https://x.com/polyjo_/status/2107927820345528687) | 使用者原创作品，2026-10-07；正文明确表示用Blockbench制作，并给模型下载。是实际创作线索，不是软件新版本公告。 |
| Data Formulator | [How To Prompt](https://x.com/HowToPrompt__/status/2053469999298416795) | 社区介绍，2026-05-10；旧链接账号为HowToAI_，oEmbed已返回现账号HowToPrompt__。长帖正文截断；技术能力以微软源码为准。 |
| OpenBB | [S / He1s_Sammy](https://x.com/He1s_Sammy/status/2082076288370593817) | 社区介绍，2026-07-28；长帖截断。帖中商业终端价格及“免费替代”对比未经本轮验证，不作为推荐依据。 |
| Scrapling | [Nav Toor](https://x.com/heynavtoor/status/2025963356293943308) | 社区介绍，2026-02-23；历史线索，长帖截断。营销性的“任意网站不可检测访问”不作为技术保证。 |
| marimo | [marimo 官方](https://x.com/marimo_io/status/1983916371869364622) | 官方公告，2025-10-30；历史X线索，介绍加入CoreWeave并继续开源。近期产品依据另见2026-09-30的官方Lens发布文。 |

官方嵌入核验方式：https://publish.twitter.com/oembed?url=原帖URL&omit_script=true 。Scrapling另一条2026-02的候选原帖（D4Vinci1/status/2025376747483447781）返回404，未作为通过的证据。

## 1. Mesh2Motion → 角色绑定与动画交付台

**建议：A，有明确资源适配前提；难度中。** 这是本轮最有差异的创作工作台：左侧角色资产与骨架树，中间3D视口，下方动作片段，右侧关节/绑定参数；用户导入模型、选骨架、调整关节、预览动作，导出带动画的模型。

- **已核实能力：**官方README描述GLB/GLTF导入、骨架选择与人工适配、动画试听和选定动画导出；导出源码还提供GLTFExporter与FBXExporter，但首版宜按更保守的GLB闭环验收。[README](https://github.com/Mesh2Motion/mesh2motion-app/blob/main/README.md)、[真实导出流程](https://github.com/Mesh2Motion/mesh2motion-app/blob/main/src/lib/processes/export-to-file/StepExportToFile.ts)。
- **原生接入：**复用现有模型处理、骨架/动画过程与Three.js场景，不重新画一个静态3D查看器冒充自动绑定。上游是TypeScript/Vite，主要依赖Three.js、JSZip等；构建依赖须按固定模板重新核对，不能直接替换现有Vite版本。[package.json](https://github.com/Mesh2Motion/mesh2motion-app/blob/main/package.json)。
- **实际阻塞：**当前导入实现会把GLTF及纹理变成blob URL。现有模板的图片CSP不允许blob，需改为同源资源或可接受的数据URI并实测；GLTF纹理、动画及导出全链路未验证。已检查的基础加载路径未引入DRACO解码器，但这不证明任意压缩模型都无需WASM；首版只承诺经验证的普通GLB。[GLTF加载器](https://github.com/Mesh2Motion/mesh2motion-app/blob/main/src/lib/processes/load-model/CustomGLTFLoader.ts)、[模型加载入口](https://github.com/Mesh2Motion/mesh2motion-app/blob/main/src/lib/processes/load-model/StepLoadModel.ts)。
- **自动保存：**原始模型及贴图、骨架类型和关节位置、绑定结果、动作选择/裁切/速度、未完成数值输入、播放位置；恢复草稿与包含原件的完整工程分开。
- **许可：**代码MIT，仓库自有模型/骨架/动作资产CC0，分别保留两份许可；GitHub通用license接口容易只返回资产CC0，不能把它当作代码许可。[代码许可](https://github.com/Mesh2Motion/mesh2motion-app/blob/main/LICENSE-MIT.MD)、[资产许可](https://github.com/Mesh2Motion/mesh2motion-app/blob/main/LICENSE-CC0.MD)。

## 2. Data Formulator → 可追溯的数据探索台

**建议：A，已有Python服务时；难度中高。** 产品应以数据源树、字段拖拽、图表舞台、分支分析轨迹和报告页为主，区别于现有单个Vega/Plot编辑器。

- **已核实能力：**微软研究项目支持混合自然语言与图形操作的数据探索、分支Data Threads、可编辑图表和报告；README列出0.7稳定版和0.8 beta，并说明CSV/Excel/JSON、截图及数据库等数据来源。[官方README](https://github.com/microsoft/data-formulator/blob/main/README.md)、[微软产品说明](https://labs.ai.azure.com/innovations/data-formulator/)。
- **原生接入：**真实连接上游分析与数据变换服务，保存每一步表格、转换结果和图表规格；不能仅接Host LLM生成一张图就声称迁移完成。当前Python要求至少3.11，依赖Flask、pandas、DuckDB、LiteLLM等；前端为React18及Flint/Vega等，和模板React版本需要隔离或适配。[Python依赖](https://github.com/microsoft/data-formulator/blob/main/pyproject.toml)、[前端依赖](https://github.com/microsoft/data-formulator/blob/main/package.json)。
- **最小范围：**先限定上传CSV→明确执行一次分析→查看变换前后表与图→分支对比→报告导出；数据库连接与SSO后置。代码执行需要独立分析进程；Python DuckDB路径不依赖客户端DuckDB-WASM，但前端/图表CSP仍待实际验证。
- **自动保存：**原始数据、字段类型、转换代码及执行版本、图表规格、分析分支、用户问题草稿、已执行结果及报告编排。恢复后不自动重新执行旧代码或刷新数据库。
- **许可：**[MIT](https://github.com/microsoft/data-formulator/blob/main/LICENSE)。

## 3. Scrapling → 结构化资料采集与校验台

**建议：A，服务接入型；难度中。** 侧重供应商目录、公开产品页、研究资料的“来源→选择器→样本表→质量检查→批次导出”，区别于现有Agent-Reach的跨平台搜索摘录。

- **已核实能力：**Python库提供HTTP与动态网页抓取、CSS/XPath选择、自适应元素匹配、并发爬取、检查点及JSON/JSONL/CSV/XML导出。[官方README](https://github.com/D4Vinci/Scrapling/blob/main/README.md)、[Spider文档](https://scrapling.readthedocs.io/en/latest/spiders/getting-started.html)。
- **原生接入：**用真实Fetcher/Selector/Spider封装受限任务API；首版先支持公开静态网页与上传HTML，动态渲染作为单独能力。Python至少3.10；基础解析含lxml/orjson，fetchers额外依赖curl_cffi、Playwright等，并非一份可直接塞进React的JS库。[依赖声明](https://github.com/D4Vinci/Scrapling/blob/main/pyproject.toml)。
- **布局与保存：**左侧URL队列，中间抽取预览和数据表，右侧字段/选择器；保存源快照、字段映射、选择器草稿、分页配置、采集检查点、失败项和人工修订。刷新只恢复任务状态，不擅自重跑网络请求。
- **边界：**不保证任何站点可达，不以“绕过所有限制”为卖点；遇到登录、验证码或限流明确显示状态。运行需要独立Python/浏览器服务，无客户端WASM前提。
- **许可：**[BSD-3-Clause](https://github.com/D4Vinci/Scrapling/blob/main/LICENSE)。

## 4. OpenBB ODP → 公司与宏观数据研究台

**建议：B，先确认数据源；难度中高。** 以证券/指标检索、时间序列、对比表、来源时间戳和研究笔记为主，首版不做交易执行。

- **已核实能力：**ODP提供统一数据接入与Python/REST消费路径；官方示例是调用历史行情并转为DataFrame，openbb-api可启动独立FastAPI服务。应复用该真实数据接口，而不是复制宣传页中的商业Workspace布局后称完整终端。[当前README](https://github.com/openbq-org/OpenBB/blob/develop/README.md)。
- **近期状态：**官方2026-08-25公告及10-01更新说明技术转交OpenBQ等后续安排。当前官方仓库已迁至openbq-org；这属于治理转移，需要固定实际可用版本，不凭大星数视为低维护成本。[官方公告](https://openbb.co/)。
- **许可核对：**当前develop分支LICENSE明确为Apache-2.0；GitHub API却返回NOASSERTION，二手页面仍有旧AGPL标记，本报告采用实际文件。代码许可不自动赋予数据提供方内容的再分发权。[LICENSE](https://github.com/openbq-org/OpenBB/blob/develop/LICENSE)。
- **接入与保存：**Python服务读取用户明确选定的供应商，先做一条真实历史序列查询；保存检索配置、数据快照和来源、图表范围、研究笔记与未完成筛选条件。各提供方密钥、额度及数据许可须逐项确认，未验证前不承诺全市场或实时行情。

## 5. marimo + Lens → 可运行、可审阅的分析笔记台

**建议：B；难度高。** 适合科研、实验记录和可复现分析：中心为反应式单元格和输出，旁边为数据依赖图；在图表区域点选或框选后提交修改/解释请求，保留审阅记录。

- **已核实能力：**marimo是反应式Python notebook。Lens是其独立widget，把屏幕选区、文字说明、输出单元格及上游代码关联；Lens自身不执行或编辑代码，实际行动依赖连接的notebook agent。[marimo](https://github.com/marimo-team/marimo)、[2026-09-30官方Lens发布](https://marimo.io/blog/introducing-marimo-lens)、[Lens设计说明](https://marimo-team.github.io/marimo-lens/overview)。
- **原生接入：**先验证Python服务模式及会话/WebSocket、单元格执行、取消、重启和导出。当前主分支要求Python至少3.11，含Starlette、WebSocket与本地扩展等；浏览器Pyodide/WASM路线仍后置。[pyproject.toml](https://github.com/marimo-team/marimo/blob/main/pyproject.toml)。
- **自动保存：**notebook源文件、单元格草稿、数据依赖和原件、控件值、执行结果及环境版本、Lens选区/截图/备注、审批历史。恢复文件不等于恢复活的Python内存，必须明确内核已重启/结果为历史快照。
- **许可：**[marimo Apache-2.0](https://github.com/marimo-team/marimo/blob/main/LICENSE)；Lens官方文档也标[Apache-2.0](https://marimo-team.github.io/marimo-lens/)。Lens作为可选扩展再核固定版本完整资产归属。

## 6. Blockbench → 低多边形游戏资产制作台

**建议：C，先做兼容性预研；难度高。** 原生产品已有3D视口、UV/像素绘制、对象树和动画时间线，辨识度强，面向游戏模型、美术与Minecraft内容创作。[README](https://github.com/JannisX11/blockbench/blob/master/README.md)。

- **适合流程：**模型/贴图导入→低多边形调整→UV与像素纹理→动画片段→标准格式和完整.bbmodel工程导出。保存模型、材质/贴图原件、对象层级、关键帧、未完成属性输入和视口状态。
- **原生集成门槛：**这是完整Vue2/Three.js应用，不是可直接挂载的React SDK。当前package.json明确配置Vue runtimeCompiler，同时带Electron路径和插件系统；固定模板CSP禁止unsafe-eval，整站搬入必须先审计并预编译模板、隔离桌面路径和动态插件。不能为了移植而悄悄放宽CSP。[package.json](https://github.com/JannisX11/blockbench/blob/master/package.json)。本轮没有运行CSP试验，因此把它列预研而非即刻可迁移。
- **许可：**实际[LICENSE.MD](https://github.com/JannisX11/blockbench/blob/master/LICENSE.MD)为GPLv3，package.json标GPL-3.0-or-later；README另写插件/主题例外。修改编辑器本体不能只按插件例外处理。

## 维护快照与下一步

以下为本次GitHub官方API查询的最后推送时间（UTC），并非稳定性证明：Mesh2Motion 2026-10-26 14:24；Data Formulator 2026-10-28 00:30；Scrapling 2026-10-28 09:31；OpenBB 2026-10-24 09:08；marimo 2026-10-28 09:15；Blockbench 2026-10-27 23:20。六仓均未归档。查询入口均为 https://api.github.com/repos/组织/仓库 。

建议下一批按“Mesh2Motion普通GLB闭环预研 + Data Formulator单CSV分析 + Scrapling公开目录采集”拆开。三者分别形成3D制作、数据探索和采集校验界面。已有供应商密钥时再加OpenBB。不要因为X帖子展示漂亮，就把这些尚未运行的候选标成已转化工作台。
