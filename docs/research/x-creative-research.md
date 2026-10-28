# X 创作与媒体项目候选

检索日期：2026-10-27（America/New_York）。本次为候选调研，没有安装、运行或转化这些项目。

**优先关注 HyperFrames，其次研究 OpenMontage；Storyboard 是很新的小体量项目。** 三者有近90天的原始X帖子。其余五项有可定位的X讨论，但帖子较旧，不能写成“最近爆火”。所有8项均不在本仓库当前61项清单中。

## 证据口径

项目功能、代码许可证和仓库关注度取自官方GitHub仓库及公开GitHub API。原始X页面有403，本次改用X官方公开oEmbed接口核实作者、正文和发布日期；该接口不提供互动量。表内GitHub星数是抓取时的独立快照，不代表X热度，也不构成排名。没有采用Grok趋势摘要作为事实来源。

推荐的工作台范围、界面形态和优先级是基于官方能力与Floatboat现有模板的工程判断，尚待实际验证。

## 近90天线索

| 项目与许可 | 一手X证据 | 核验到的关注度 | 适合转成的工作台 | 接入成本与范围 |
| --- | --- | --- | --- | --- |
| **[HyperFrames](https://github.com/heygen-com/hyperframes)** · [Apache-2.0](https://github.com/heygen-com/hyperframes/blob/main/LICENSE) | [官方Studio发布帖](https://x.com/HyperFrames_/status/2107149824189698558)，2026-10-05，介绍描述生成、共享时间线和画面批注编辑 | GitHub API 74,027★；原帖互动量未能一手取得 | **品牌动效与产品演示工坊**：中央16:9舞台、下方分镜与时间轴、右侧品牌变量、画面定位评论；保存可编辑工程并导出MP4 | 中。开源核心把HTML/CSS/媒体和可定位动画转成确定性视频。先复用渲染CLI与固定片段，验证Node22、浏览器渲染和FFmpeg；不要把有账号体系的Studio整套当作可直接嵌入SDK。依据：[README](https://github.com/heygen-com/hyperframes#readme)、[官方快速开始](https://hyperframes.heygen.com/quickstart)。 |
| **[OpenMontage](https://github.com/calesthio/OpenMontage)** · [AGPL-3.0](https://github.com/calesthio/OpenMontage/blob/main/LICENSE) | [Lucas社区介绍帖](https://x.com/lksmlabc/status/2098428853987557862)，2026-09-11。可核实作者确实在X介绍项目；帖中“热榜第一”是作者说法，未作为独立事实 | GitHub API 72,490★；X互动量未一手核实 | **视频制作审批台**：选题→脚本→分镜→素材→粗剪→成片各阶段分别审阅；素材架、镜头列表、生产记录和版本对照 | 高。是供编码Agent使用的制作系统与工具集合，非一个可直接挂载的React视频组件；先封装一条明确管线，接真实本地媒体处理服务，保留阶段确认、失败恢复和工程文件。复制修改代码需保留AGPL边界；可考虑独立服务接入。依据：[README](https://github.com/calesthio/OpenMontage#readme)、[提供方说明](https://github.com/calesthio/OpenMontage/blob/main/docs/PROVIDERS.md)。 |
| **[Storyboard](https://github.com/saeedvaziry/storyboard)** · [MIT](https://github.com/saeedvaziry/storyboard/blob/main/LICENSE) | [Caleb原始编辑器演示](https://x.com/calebporzio/status/2104945478055989489)与[Saeed发布仓库](https://x.com/saeed_vz/status/2105044303273730547)，均2026-09-29。当前官方README明确引用Caleb原帖；旧仓库`caleb-video-editor`已重定向 | GitHub API 64★；未取得X互动量。**是新颖候选，不能称仓库已爆火** | **代码分镜工作室**：逐场景代码、即时预览、镜头胶片条、节拍吸附和音效轨；每段独立保存、回退和渲染 | 中高。官方需macOS/Linux、Node≥22.12、FFmpeg及本地编码Agent。首版应限定可信场景模板和独立渲染执行器，不能只把任意模型代码放进主工作台进程。可选音乐/音效引擎另有依赖与许可证。依据：[README](https://github.com/saeedvaziry/storyboard#readme)。 |

## 有历史X讨论，可作为后续补充

| 项目与许可 | 原始X帖子与时间 | 核验到的关注度 | 工作台形态与真实接入 |
| --- | --- | --- | --- |
| **[Chatterbox](https://github.com/resemble-ai/chatterbox)** · [MIT](https://github.com/resemble-ai/chatterbox/blob/master/LICENSE) | [Resemble AI官方多语言发布帖](https://x.com/resembleai/status/1963628736810512826)，2025-09-04；当时宣布23语言。不是当前V3新发布证据 | GitHub API 27,352★；X互动量未核实 | **配音审校台**：逐段台词、声线与语言、波形试听、不同take比较、通过后整段导出。当前README已有Multilingual V3；可封装Python推理服务，模型文件/音频任务和生成记录持久化。中等成本，先用普通示例音色，不把本地文稿编辑当成TTS已验证。依据：[当前README与示例](https://github.com/resemble-ai/chatterbox#readme)。 |
| **[ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5)** · [MIT](https://github.com/ace-step/ACE-Step-1.5/blob/main/LICENSE) | [Wildminder介绍ACE-Step UI](https://x.com/wildmindai/status/2018952479744917564)，2026-02-04；该帖子展示的是社区UI，不能把该UI归为官方代码 | GitHub API 14,104★；X互动量未核实 | **音乐小样与配乐工作台**：歌词段落、BPM/调性、版本试听、波形选区重绘和配乐资产导出。高成本，需要Python/模型推理与异步任务。官方REST API是可取接口；XL版本README要求至少12GB显存（offload）、建议20GB以上，不能套用较小模型的低显存宣传。依据：[官方仓库](https://github.com/ace-step/ACE-Step-1.5#readme)。 |
| **[OpenCut](https://github.com/OpenCut-app/OpenCut)** · [MIT](https://github.com/OpenCut-app/OpenCut/blob/main/LICENSE) | [ComfyUI官方社区展示](https://x.com/ComfyUI/status/1955305894989926702)，2025-08-12；证实OpenCut曾被接进ComfyUI | GitHub API 96,535★；X互动量未核实 | **轻量剪辑台**：素材箱、预览、原生时间线、字幕与导出队列。中高成本。主仓库正全面重写，Rust核心/插件API/MCP等是规划项；官方建议当前使用[classic版](https://github.com/opencut-app/opencut-classic)。转化前先锁可工作版本，验证媒体导入、浏览器渲染和导出，避免用重写规划代替已实现功能。依据：[当前README](https://github.com/OpenCut-app/OpenCut#readme)。 |
| **[Open Lovable](https://github.com/firecrawl/open-lovable)** · [MIT](https://github.com/firecrawl/open-lovable/blob/main/LICENSE) | [Developers Digest v3演示帖](https://x.com/devdigest/status/1991189551562531279)，2025-11-19；展示URL到品牌化React页面的生成 | GitHub API 28,815★；X互动量未核实 | **网页再设计台**：原页面参考、新页面预览、设计变量、文件差异和导出工程。高成本。README依赖Firecrawl、模型提供方和Vercel/E2B沙箱；不能仅加Host LLM就宣称运行链路齐全。首版限定授权参考站点/自有素材和可导出静态页面，独立沙箱执行生成代码。依据：[README依赖与配置](https://github.com/firecrawl/open-lovable#readme)。 |
| **[LongCat-Video / Avatar 1.5](https://github.com/meituan-longcat/LongCat-Video)** · [MIT](https://github.com/meituan-longcat/LongCat-Video/blob/main/LICENSE) | [Fahd Mirza演示帖](https://x.com/fahdmirza/status/2058417066605265295)，2026-05-24；官方README记录Avatar 1.5于05-21发布 | X搜索结果一手页面显示774次浏览的缓存快照，**不足以证明热度很高**；仓库页面约9.3k★ | **讲解视频/虚拟角色制片台**：人物参考图、音频、镜头预览、口型/动作审阅、任务队列。高成本。官方13.6B视频底座、PyTorch/CUDA/FlashAttention与独立权重下载；可研究远端GPU服务接口，不能把Host文本模型作为视频推理引擎。依据：[官方安装与Avatar说明](https://github.com/meituan-longcat/LongCat-Video#readme)。 |

## 下一批建议

1. **HyperFrames优先。** 有2026年10月官方X发布线索，HTML/Node渲染与现有技术栈较接近，能做出区别于文档/聊天的时间线产品。先完成“编辑模板→保存工程→预览→真实MP4导出”。
2. **Chatterbox补配音链路。** X证据较旧，但用途清晰，可与已实现faster-whisper的转写工作台形成互补；需要真实TTS服务验收。
3. **OpenMontage做小范围技术预研。** 近期讨论且产出明确，但运行、素材、许可和Agent编排比前两项重；从一条有审批点的生产管线开始，不承诺整站搬迁。

如果严格只选“最近90天在X出现的项目”，应保留HyperFrames、OpenMontage、Storyboard，并把后者标作新颖小项目。当前证据不足以给它们排出可重复的X热度名次。

## 可复核来源

- X官方oEmbed：`https://publish.twitter.com/oembed?url=<原帖URL>&omit_script=true`，本次核实上表七条帖子；Storyboard两帖由并行主线程同法核实。接口正文与日期不等于实时互动计数。
- GitHub公开仓库元数据：`https://api.github.com/repos/<owner>/<repo>`，本次直接抓取8个创作候选（含未纳入主表的Next AI Draw.io）；星数仅为2026-10-27本地日期的快照。
- [Next AI Draw.io](https://github.com/DayuanJiang/next-ai-draw-io)另有36,449★、Apache-2.0、可编辑draw.io/XML/PNG/SVG能力，但本次未取得确切X原帖，不放入“X已验证讨论”主表。
