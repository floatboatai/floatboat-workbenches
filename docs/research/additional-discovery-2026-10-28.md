# Reddit 补充候选：文档与媒体处理

核查日期：2026-10-28。两项均不在现有72项目录及此前研究名单中。本次只读取公开讨论、官方源码与元数据，没有安装运行，适配等级是工程判断。讨论票数是搜索结果当时显示的快照，不是实时排名。

## EdenText：分页文档制作与校订

- 社区入口：[Reddit 2026-09-10 新项目周帖](https://www.reddit.com/r/selfhosted/comments/1wcxa5u/new_project_megathread_week_of_10_sep_2026/)，作者介绍的评论在搜索结果显示约7票。不是热门程度很高的证据。
- [官方仓库](https://github.com/stffnb/edentext)提供浏览器内的分页编辑、DOCX/ODT读写、批注与修订、PDF导出；当前仍标为beta。适合信函、报告、合同校订，和已有富文本笔记的差别在真实页面和文档格式往返。
- 当前[package.json](https://github.com/stffnb/edentext/blob/main/package.json)为0.12.0，Svelte5、Tiptap3、docx、odf-kit。不能把整个Svelte/Vite应用当成现成React组件安装。
- **WASM边界明确存在**：[语法检查](https://github.com/stffnb/edentext/blob/main/src/lib/spell/grammar.svelte.ts)按需加载Harper WASM及worker，默认关闭；[拼写词典](https://github.com/stffnb/edentext/blob/main/src/lib/spell/dictionary.ts)按需加载Hunspell WASM。首版需要明确关闭这些能力，或等待客户端与模板支持，不能只据“纯浏览器”就承诺全部运行。
- [LICENSE](https://github.com/stffnb/edentext/blob/main/LICENSE)为AGPL-3.0，包声明AGPL-3.0-only，仓库另有商业许可选项。采用其源码不能沿用原创封装的MIT声明覆盖上游。
- 建议流程：DOCX/ODT → 分页与批注审校 → 修订确认 → 原格式/PDF。视觉以纸张、标尺和页边批注为主。需要自动保存完整文档树、格式、原件、批注、修订及尚未完成的输入；不能只保存HTML。
- 初筛：**第二梯队，中高难度**。先做实际复杂DOCX/ODT往返与固定CSP探针，再考虑批量转化；尚未验证格式保真。
- GitHub API快照：未归档，创建2026-06-18，最后push 2026-10-23；559星仅作仓库元数据，不代表X/Reddit热度。

## SnapOtter：批量媒体处理与配方流水线

- 社区入口：[2026-04-03作者发布帖](https://www.reddit.com/r/selfhosted/comments/1sbgjxk/i_built_stirlingpdf_but_for_images/)，搜索结果显示约1134票。该帖使用旧名Stirling Image；原仓库现跳转至[SnapOtter](https://github.com/snapotter-hq/SnapOtter)，不能把旧帖的部署、功能及许可承诺当作现版状态。
- [现版官方README](https://github.com/snapotter-hq/SnapOtter#readme)说明提供图像、视频、音频、PDF等处理、REST API及流水线。建议聚焦图片批处理、转换参数复用、前后对照与结果归档，避免重复制作已有图片画板。
- [根package.json](https://github.com/snapotter-hq/SnapOtter/blob/main/package.json)要求Node>=22.22，描述完整运行栈包含PostgreSQL和Redis。README另有单容器入口；容器能在本机运行不等于能装入普通工作台源码包。
- 合理接入路线是**外置服务+任务审阅台**：复用真实API处理文件，在工作台保存输入原件、参数配方、显式任务ID、结果和失败状态。重启后查询任务状态，不能盲目重发有成本的处理。
- [许可说明](https://github.com/snapotter-hq/SnapOtter/blob/main/LICENSING.md)：社区代码AGPL-3.0，`packages/enterprise/`有单独商业许可；社区工具、批量、流水线及单节点无需商业密钥。不能把整个monorepo当统一许可的嵌入组件。
- 视觉建议：批次文件托盘、操作序列、前后双图和逐文件结果表。首版不把OCR/转写/本地AI模型未配置的任务显示为可执行。
- 初筛：**服务型备选，高难度**。适合用户确有批处理需求时做一套窄流程，不列入最轻量的下一批。
- GitHub API快照：未归档，创建2026-03-29，最后push 2026-10-28；2870星仅作仓库元数据。

上述候选的正式数据、未完成草稿、原始文件和后台作业状态都需要各自的持久化设计。本轮没有修改catalog或声称已完成工作台。
