# 从 X 传播线索筛选下一批工作台

检索日期：2026-10-27，America/New_York。以可定位的原始X帖子为入口，再核对官方GitHub仓库、许可与转化范围。当前61项目录和此前32个AI候选中没有下表9项。本轮只研究，没有将候选标为实现，也没有安装或运行项目。

## 推荐清单

X官方公开oEmbed已核对下列帖子的作者、正文和日期，但不提供统一点赞/浏览计数。因此这是有X传播证据的产品候选清单，**不是实时X热度排名**。GitHub星数为本次直接GitHub API快照，和X互动量分开；帖子日期按纽约时间列示。

| 项目 | GitHub星数快照 | X原帖与日期 | 建议工作台与优先级 | 许可 / 主要接入范围 |
| --- | ---: | --- | --- | --- |
| [HyperFrames](https://github.com/heygen-com/hyperframes) | 74,032 | [官方Studio演示](https://x.com/HyperFrames_/status/2107149824189698558)，10-05 | **首选：品牌动效与产品演示工坊**；舞台、时间轴、品牌变量与MP4导出 | Apache-2.0；接HTML/Node渲染核心，验证FFmpeg与浏览器渲染，不把完整在线Studio当SDK |
| [Graphify](https://github.com/Graphify-Labs/graphify) | 137,068 | [Sofía Sicilia介绍](https://x.com/SofiaSici/status/2094666731507597429)，09-01 | **首选：代码与资料知识地图**；关系图、来源侧栏、路径查询与关系修订 | 当前Apache-2.0，保留历史MIT部分；Python提取器＋graph.json/报告适配 |
| [PageIndex](https://github.com/VectifyAI/PageIndex) | 39,845 | [官方Jev＋PageIndex检索示例](https://x.com/PageIndexAI/status/2105896667446940134)，10-02 | **首选：长报告审阅台**；章节树、PDF页、页码引用和问答审校 | MIT；Python/模型服务与页级引用，示例Jev另为Apache-2.0 |
| [DeepTutor](https://github.com/HKUDS/DeepTutor) | 46,149 | [近期介绍帖](https://x.com/chasen_liao/status/2114702883673501719)，10-26 | **下一批：课程与错题台**；教材、知识点、练习、判题与复习计划 | Apache-2.0；完整Python/网页平台较重，先收窄到一门课程闭环 |
| [Agent-Reach](https://github.com/Panniantong/Agent-Reach) | 105,005 | [硅基禅心介绍](https://x.com/Silicon_Zen/status/2114955947881938971)与[社区使用思路](https://x.com/Lovislexus/status/2114869687783739824)，10-27 | **下一批：跨平台调研资料台**；来源队列、搜索结果、证据摘录与去重 | MIT；独立CLI/浏览器后端，各平台登录、限流、失效要按实际状态呈现 |
| [OpenMontage](https://github.com/calesthio/OpenMontage) | 72,490 | [社区介绍](https://x.com/lksmlabc/status/2098428853987557862)，09-11 | **预研：视频制作审批台**；脚本、分镜、素材、粗剪和成片逐阶段确认 | AGPL-3.0；Agent制作管线＋Python媒体工具；先完成一条可恢复管线 |
| [DeerFlow](https://github.com/bytedance/deer-flow) | 84,508 | [作者2.0发布帖](https://x.com/henry19840301/status/2026847782456406331)，02-25，**历史线索** | **后续：研究交付项目室**；研究计划、来源、分步产物与可编辑报告 | MIT；子代理、沙箱、记忆与后端较重，和现有LangGraph部分重叠 |
| [MiroFish](https://github.com/666ghj/MiroFish) | 82,387 | [介绍帖](https://x.com/AYi_AInotes/status/2035274445846360123)，03-21，**历史线索** | **后续：情景推演实验台**；角色、假设、模拟时间线和方案对比 | AGPL-3.0；多代理模拟、模型与Zep等独立服务；模拟结果不当作经验证的现实预测 |
| [GEOInflow](https://github.com/yaojingang/GEOInflow) | 619 | [作者发布帖](https://x.com/yaojingang/status/2114576054018818536)，10-26 | **新作观察：AI搜索流量运营台**；AI爬虫访问、页面覆盖、引荐与内容改善记录 | MIT；PostgreSQL/Redis/worker与真实日志数据；小体量新项目，暂不称成熟爆款 |

排序是本次对产品价值、独立界面形态和接入成本的判断，不按传播数值排榜。优先做HyperFrames、Graphify、PageIndex，能分别形成时间线、知识图谱和双页报告阅读台，和现有工作台有明确差异。

## 新增两项的核验细节

**Graphify** 的一手[README](https://github.com/Graphify-Labs/graphify#readme)说明：代码使用tree-sitter本地分析，输出graph.json、graph.html与报告；文档/媒体的语义处理另接模型。建议先做真实代码图导入、节点/边来源、路径查询与人工注释保存，再接模型解析文档；不把商业Cloud的常驻同步能力算作已开源本地核心。当前[NOTICE](https://github.com/Graphify-Labs/graphify/blob/v8/NOTICE)明确整体Apache-2.0，历史MIT贡献保留原条款。X原帖为09-01，官方oEmbed可读；帖子中的星数是发帖时作者说法，本表使用独立API快照。

**Agent-Reach** 的一手[README](https://github.com/Panniantong/Agent-Reach#readme)确认是多个平台的接入工具，平台是否需登录、可用哪些动作并不相同。首版可以做公开网页/视频/仓库来源的采集清单、证据摘录和导出；需要登录的平台单独验证连接状态。它不是已运行在Floatboat中的连接器，也不能因为名字叫Agent就直接复用Host模型调用。10-27两条X帖均经官方oEmbed核验。

## 其他创作线索

[Storyboard](https://github.com/saeedvaziry/storyboard)有09-29的[原始演示](https://x.com/calebporzio/status/2104945478055989489)及[衍生项目发布](https://x.com/saeed_vz/status/2105044303273730547)，但仓库仅64星，适合作为分镜交互参考，不应包装成热门成熟项目。Chatterbox、ACE-Step、OpenCut、Open Lovable、LongCat等的较早X线索和依赖见[创作研究](x-creative-research.md)。OpenCut主仓库正重写，应先核对官方classic版本；Next AI Draw.io虽值得看，但本次未找到确切X原帖，未放进主表。

## 来源与复核方法

- 功能与许可只引用官方仓库、README、LICENSE、NOTICE。上表仓库链接即功能与星数的一手入口，元数据通过`https://api.github.com/repos/<owner>/<repo>`直接查询。
- 原帖通过X官方公开嵌入接口`https://publish.twitter.com/oembed?url=<原帖URL>&omit_script=true`核对。X网页部分403，官方嵌入仍提供公开正文。互动数未统一取得，因此不推断精确X排名。
- [AI/行业研究](x-ai-research.md)保留5项详细范围与来源；[创作/媒体研究](x-creative-research.md)保留8项详细范围与来源。二手互动量如有出现，均单列为未经原站复核的快照，未用于本表排序。
- 所有推荐都需要后续实际引擎、保存恢复、失败状态与导出验收；本次没有声称完成转化。
