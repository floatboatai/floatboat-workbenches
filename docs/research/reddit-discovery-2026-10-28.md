# Reddit 新候选核查 · 2026-10-28

本次核对现有 `catalog.json` 的72项及既有 `docs/research/`，以下8项均未列入现有catalog，也未出现在此前研究的GitHub仓库清单中。这里只做选型，没有实施或标成已验证。Reddit是发现入口，技术与许可判断来自项目自身README、代码及依赖清单。票数是搜索索引当时可见值，会变化，不构成热门榜；没有读到就不补猜。所有适配方式、布局与优先级是本次工程判断，尚未在Floatboat模板中运行。WASM仍按客户端未就绪处理。

建议先验证 **Oasis Editor、Invoice Builder、Grocy、Forms-Engine**：分别补充分页文档、报价单、库存盘点和条件问卷规则。前两项有明确的可复用编辑/业务代码；Grocy必须接真实服务；Forms-Engine可以先用独立规则核与预览器，完整发布服务后置。

| 项目 | Reddit线索 | 建议工作台 | 结论 |
| --- | --- | --- | --- |
| Oasis Editor | [2026-08-31 作者帖](https://www.reddit.com/r/opensource/comments/1w3corq/im_building_an_opensource_docx_document_editor/)；索引显示0票 | 分页DOCX编辑与版式校样 | 优先做兼容性验证；中 |
| Invoice Builder | [2026-08-26 更新帖](https://www.reddit.com/r/selfhosted/comments/1vz6rxg/update_invoice_builder_7_months_ago_i_shared_my/)；+5；[2月首发帖](https://www.reddit.com/r/selfhosted/comments/1qvgr4z/invoice_builder_a_fully_offlinefirst_invoicing/) +40 | 报价/发票排版与历史快照 | 优先；中，数据库及PDF适配 |
| Grocy | [库存与配方使用讨论](https://www.reddit.com/r/grocy/comments/1vvjnw7/has_anyone_else_gone_overboard_with_grocy_like_me/)、[快速采购清单讨论](https://www.reddit.com/r/grocy/comments/1w2xfcy/adding_to_shopping_list/)；索引约1–2个月前，确切日期/票数未成功读取 | 食材/耗材盘点、临期与配方复核 | 有服务后优先；中 |
| Forms-Engine | [2026-09-19 作者讨论](https://www.reddit.com/r/angular/comments/1wk7etu/open_source_form_engine_where_the_whole_editor_is/)；+10 | 条件问卷规则与版本预演 | 可先做纯前端核；中 |
| OpenPost | [2026-09-07 作者帖](https://www.reddit.com/r/foss/comments/1wa2075/free_opensource_image_and_video_editors_in_the/)；+185 | 多平台稿件预览、素材编排 | 第二梯队；中–高 |
| MasterSelects | [2026-02-02 作者帖](https://www.reddit.com/r/VideoEditors/comments/1qtq5tn/opensource_browserbased_video_editor_with_webgpu/)；+164 | 视频/节点合成审阅 | 暂缓；WASM、GPU和私有服务边界 |
| OpenSub | [2026-06-27 作者帖](https://www.reddit.com/r/editing/comments/1uh8gqk/an_opensource_subtitle_editor_for_creating/)；+3 | 动态字幕时间轴 | 暂缓；许可元数据冲突及原生运行时 |
| EditorScripts | [2026-08-02 编辑工具作者帖](https://www.reddit.com/r/editors/comments/1vd48jr/aug_2026_open_source_tools_devs/)；作者评论+5，整帖+11 | Resolve标记/交付报告 | 仅有Resolve Studio集成时考虑 |

## 1. Oasis Editor：分页文档与DOCX校样

[官方项目](https://github.com/celsowm/oasis-editor)是Canvas分页编辑器，提供TypeScript包、React/Vue适配器、命令/插件API、DOCX与PDF导出、`change`事件及`getState()`。可直接集成其原生布局/编辑核心，而不是拿普通富文本编辑器仿一套Word界面。[README/API](https://github.com/celsowm/oasis-editor/blob/main/README.md)

- 工作流程：DOCX导入→分页、表格/图片与段落调整→逐页校样→DOCX/PDF及完整工程导出。建议纸张居中的连续页面、左侧页缩略图、上方精简排版工具和右侧问题抽屉。
- 首版真实集成：固定`oasis-editor`版本及官方React挂载适配；使用原生命令、导入导出和布局。每次`change`保存完整文档、原始OOXML包和资源引用；未提交侧栏输入单独保存，切换文档按实例隔离。
- 边界：官方明确React适配器是mount-only，切换配置/文档不能当普通受控组件处理。其接口仍在稳定，复杂DOCX必须用实际样本往返，不能承诺完全兼容Word。[嵌入约定](https://github.com/celsowm/oasis-editor/blob/main/README.md)
- 依赖：当前`0.0.195`直接依赖包含Solid、fflate、JSZip、brotli等，未见显式WASM直接依赖；这不等于已通过CSP和传递依赖审查。字体/图片、worker和长文档性能需实测。[package.json](https://github.com/celsowm/oasis-editor/blob/main/package.json)
- 许可MIT，未归档；API记录最近push为2026-10-12 UTC。[LICENSE](https://github.com/celsowm/oasis-editor/blob/main/LICENSE)、[仓库元数据](https://api.github.com/repos/celsowm/oasis-editor)

## 2. Invoice Builder：报价单与发票排版

官方已有报价/发票、客户与条目、税费折扣、部分付款、PDF预览、JSON/XLSX导入导出及文档快照；提供Electron和可自托管Node服务两种模式。[官方README](https://github.com/piratuks/invoice-builder/blob/main/README.md)

- 工作流程：选客户/项目→编辑报价条目和计算参数→纸张版式校样→导出PDF与文档快照。布局用明细表＋可打印单据双栏，避免通用仪表盘。
- 首版真实集成：复用上游`contracts`、计算/文档模型、React PDF模板与布局组件。把Electron IPC替换成模板路由；数据库边界要重接模板SQLite，或接上游真实Node服务。若只做自写表单而不复用这些核心，不应称为转换完成。
- 自动保存：明细原始字符串、客户/银行快照、币种/税费/折扣、版式、Logo与签名资源、付款草稿；正式编号和付款状态须明确操作，恢复不能自动寄送或记账。
- 依赖：仓库`3.2.1`是workspace；`packages/core`依赖原生`sqlite3`及`pg`，不能原封塞进现有模板。前端使用React19、`@react-pdf/renderer`、ExcelJS等。PDF字体、native模块和版本适配需单独验证。[core](https://github.com/piratuks/invoice-builder/blob/main/packages/core/package.json)、[renderer](https://github.com/piratuks/invoice-builder/blob/main/apps/renderer/package.json)
- 首版应定位单据制作与核对。上游提到UBL/Peppol/XRechnung输出，本次没有验证各地区会计/税务适用性，不将其转述为工作台已获合规保证。
- 许可MIT；未归档，最近push2026-10-26 UTC。[LICENSE](https://github.com/piratuks/invoice-builder/blob/main/LICENSE)、[元数据](https://api.github.com/repos/piratuks/invoice-builder)

## 3. Grocy：库存、临期和配方操作台

官方支持库存、临期/过期概览、产品与单位转换、配方/餐计划和购物清单。其Web前端通过同一REST API完成大部分操作，有Swagger入口，适合做专注于盘点/采购的工作台。[官网](https://grocy.info/)、[README的REST API与运行条件](https://github.com/grocy/grocy/blob/master/README.md)、[API](https://demo.grocy.info/api)

- 工作流程：按位置盘点→核对批次/数量/临期→查看配方缺料→形成购物清单。布局采用货架分组列表、扫码输入区、批次抽屉和临期时间带。
- 真实集成：接用户的Grocy实例，先做只读库存、配方与清单，再加入明确提交的盘点修正。不能在工作台另造一份库存就宣称保留Grocy的业务引擎。
- 自动保存：本次盘点原始数量、位置、待处理差异、配方份数和复核备注，记录所基于的远端库存版本/读取时间；恢复草稿不得自动消费或调整库存。
- 运行门槛：当前master要求PHP8.5和SQLite3.40+及扩展，不是Node内嵌包；使用外置自托管服务，WASM不是核心前提。首次配置与单位换算是实质UX成本，Reddit用户也反馈了盘点、配方输入繁琐的问题。[运行条件](https://github.com/grocy/grocy/blob/master/README.md)、[用户场景](https://www.reddit.com/r/grocy/comments/1vvjnw7/has_anyone_else_gone_overboard_with_grocy_like_me/)
- 许可MIT；未归档，最近push2026-09-16 UTC。[LICENSE](https://github.com/grocy/grocy/blob/master/LICENSE.md)、[元数据](https://api.github.com/repos/grocy/grocy)

## 4. Forms-Engine：条件问卷规则调试

不同于已有SurveyJS的问卷编辑，此项目值得切成“分层条件规则与发布版本预演”工作台。官方有steps/tabs/sections/questions层级、可见/必填条件、版本固定的响应和草稿预览；纯核导出定义类型、归一化、规则引擎，DOM/Lit并非纯核必需。[官方README](https://github.com/JoshuaLeoSmith/forms-engine/blob/master/README.md)、[独立renderer](https://github.com/JoshuaLeoSmith/forms-engine/blob/master/packages/renderer/README.md)

- 工作流程：导入问卷定义→查看规则/层级→用不同答案模拟条件分支→核对版本差异→导出定义和测试场景。布局采用结构树、中央实际问卷和右侧规则追踪，而非再做一个普通表单搭建器。
- 真实集成：固定`@forms-engine/renderer/core`运行规则与归一化；可挂载官方Lit custom element，并使用其内存草稿预览能力。只在接入原服务后开放实际发布和真实响应提交。
- 自动保存：问卷定义、规则草稿、未完成条件值、模拟答案、测试场景与基线版本；分清规则导致的隐藏答案清理和用户尚未完成的设计草稿。
- 依赖与限制：renderer `1.1.0`运行依赖仅Lit3；完整上游是Java21/Spring Boot、Angular、MongoDB、MinIO，地址补全另用Photon服务。纯核可先适配；完整平台不是一键迁移。[package](https://github.com/JoshuaLeoSmith/forms-engine/blob/master/packages/renderer/package.json)、[运行拓扑](https://github.com/JoshuaLeoSmith/forms-engine/blob/master/docker-compose.yml)
- MIT；未归档，最近push2026-09-19 UTC。项目还小，应先对照上游shared rule fixtures验证语义；有SurveyJS功能重叠，因此排在业务空白项之后。[LICENSE](https://github.com/JoshuaLeoSmith/forms-engine/blob/master/LICENSE)、[元数据](https://api.github.com/repos/JoshuaLeoSmith/forms-engine)

## 5. OpenPost：有讨论度，但适合缩小切面

官方当前包括平台分别编稿/预览、素材、排期、工作流、图像与视频编辑；Go服务、SvelteKit前端，默认单容器SQLite与本地媒体。API/SDK支持草稿与发布流程。[官方README](https://github.com/getopenpost/openpost/blob/main/README.md)

- 可选切面：多平台稿件校样与发布包制作，采用并排平台预览卡、线程顺序和素材故事板。自动保存每个平台的文字变体、素材顺序、品牌变量和未提交的排期草稿。
- 最小真实集成：复用`platform-text`、`social-preview`、`draft-transfer`的实际规则与序列化，或接真实OpenPost API管理草稿；真实发布必须显式操作。需要继续核对各子包API，不能仅凭名字判断可直接嵌入。[platform-text](https://github.com/getopenpost/openpost/blob/main/packages/platform-text/package.json)、[API说明](https://openpo.st/docs/api-reference)
- 不建议第一版搬整个图像/视频编辑器：Svelte/Bun/Vite8与现有React工具链不同；直接依赖有background-removal、ONNX Runtime、Transformers、Mediabunny解码扩展，WASM/GPU及模型资源必须逐条验证。可先避开这些路径，但需实际依赖图证明。[前端包清单](https://github.com/getopenpost/openpost/blob/main/apps/web/package.json)
- AGPL-3.0-only及第三方许可分别保留；未归档，最近push2026-10-28 UTC。[LICENSE](https://github.com/getopenpost/openpost/blob/main/LICENSE)、[第三方说明](https://github.com/getopenpost/openpost/blob/main/licenses/README.md)、[元数据](https://api.github.com/repos/getopenpost/openpost)

## 6–8. 暂缓的三个发现

### MasterSelects

确有本地React/WebGPU/WebCodecs时间轴、节点合成与项目持久化方向，视觉形态也很适合工作台；但当前源码`3.3.6`要求Node24.16，并包含FFmpeg WASM、libraw-wasm、ONNX等多条执行路径。许可文件明确私有hosted kernel不包含在公开仓库内，因此不能把演示站全能力当成可搬迁的开源能力。建议WASM/worker/GPU能力验收后再做独立技术验证，首版需固定时间轴/素材引用/效果参数和未完成编辑的保存格式。[README](https://github.com/Sportinger/MasterSelects/blob/master/README.md)、[package](https://github.com/Sportinger/MasterSelects/blob/master/package.json)、[许可边界](https://github.com/Sportinger/MasterSelects/blob/master/LICENSING.md)

AGPL-3.0-only；未归档，最近push2026-10-28 UTC。[元数据](https://api.github.com/repos/Sportinger/MasterSelects)

### OpenSub

作者展示的是自动字幕、时间轴、动画与样式编辑。代码运行在Svelte/Tauri，Rust依赖包含`whisper-rs`和`headless_chrome`，不能当普通浏览器组件直接搬入。[README](https://github.com/SivaPA08/opensub)、[Cargo.toml](https://github.com/SivaPA08/opensub/blob/main/src-tauri/Cargo.toml)

更关键的是根LICENSE为GNU GPL v3文本，而package.json标MIT，GitHub许可API返回NOASSERTION。不能按MIT重用，需先明确适用许可与核心运行服务，再考虑字幕条目/时间、动画、原视频和模型结果的完整保存。[LICENSE](https://github.com/SivaPA08/opensub/blob/main/LICENSE)、[package](https://github.com/SivaPA08/opensub/blob/main/package.json)、[元数据](https://api.github.com/repos/SivaPA08/opensub)。未归档但最近push仍为2026-06-27 UTC，当前证据不足以列为近期活跃首批。

### EditorScripts

作者给出的Lua脚本可以生成标记报告、复制标记、导出静帧、重命名时间线及版本递增。真实价值是接DaVinci Resolve Studio的生产流程；官方明确只支持Studio20+，免费版不支持，Linux未测试。[官方README](https://github.com/oliwiergesla/editorscripts/blob/main/README.md)

适合的未来形态是交付报告台：导入/读取Resolve的真实标记→逐条核对→导出报告；保存标记快照、修订备注和筛选条件。但离开Resolve仅做一张自写表格不等于原生集成，因此当前不排入独立工作台批次。GPL-3.0；未归档，最近push2026-09-19 UTC。[LICENSE](https://github.com/oliwiergesla/editorscripts/blob/main/LICENSE)、[元数据](https://api.github.com/repos/oliwiergesla/editorscripts)

## 本轮边界

EdenText和Stirling Image由主线单独核查，本文件不重复记作独立发现。Homebox已查看上游，但本轮未找到可可靠对应的Reddit帖子，不混入“Reddit发现”推荐。ChartDB/Rackula的搜索无有效结果，也没有凭已有印象补造社交链接。以上只有源码与文档级选型，没有运行样例或客户端导入验收。
