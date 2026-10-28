# X 项目线索：AI 与行业工具

检索日期：2026-10-27（America/New_York）。目标是补充可转成 Floatboat 工作台的项目，优先最近90天的原始讨论。以下5项均未出现在本仓库当前61项目录及此前32个AI候选中；本次只做选题研究，未实现或验证运行。

## 来源与热度口径

X 网页直读返回403，但通过 **X 官方公开 oEmbed**（`https://publish.twitter.com/oembed?url=<原帖URL>&omit_script=true`）成功核对以下帖子的作者、正文和发布日期。oEmbed不提供点赞、浏览或转发数，因此本表不编造实时互动量，也不把GitHub星数当作X热度。可以确认有实际X发布/讨论，尚不足以构成全站热门排名。DeerFlow和MiroFish的已核验帖子较早，单列为历史热议线索。

功能、依赖与许可依据各项目官方仓库；“建议工作台”和成本高低为本次产品判断。

| 项目与一手仓库 | 许可 | 原始 X 帖子、日期及可核验信号 | 建议转化成的工作台 | 接入成本与边界 |
| --- | --- | --- | --- | --- |
| **[PageIndex](https://github.com/VectifyAI/PageIndex)**；相关示例 [jev-doc-search](https://github.com/VectifyAI/jev-doc-search) | PageIndex [MIT](https://github.com/VectifyAI/PageIndex/blob/main/LICENSE)；Jev示例 [Apache-2.0](https://github.com/VectifyAI/jev-doc-search/blob/main/LICENSE) | 官方 [@PageIndexAI 原帖](https://x.com/PageIndexAI/status/2105896667446940134)，**2026-10-02**，宣布开源Jev＋PageIndex长文检索示例；正文、作者和日期已核验，互动数不可见。不能把这个具体示例的发布误称为PageIndex首次发布。 | **长报告审阅台**：左侧章节树，中间PDF页，右侧回答与页码证据；保存问题、引用片段与人工核对意见。适合财报、产品手册、研究报告。 | **中**。官方SDK支持本地/云模式，Python索引及模型服务需独立接入；长文处理和引用定位应实测。不能因不使用向量库就声称无需模型、零成本或任意文档必然准确。 |
| **[DeepTutor](https://github.com/HKUDS/DeepTutor)** | [Apache-2.0](https://github.com/HKUDS/DeepTutor/blob/main/LICENSE) | [@chasen_liao 介绍帖](https://x.com/chasen_liao/status/2114702883673501719)，**2026-10-26**；介绍上传课本/讲义、讲题/出题及长期学习记忆。正文和日期已核验，互动数不可见。官方仓库列有10月19日v1.6.15更新。 | **课程自学与错题工作台**：教材阅读、知识点地图、逐题练习、错题复习与学习进度。首版收窄为一门课程的资料→出题→答题→复习闭环。 | **中高**。它已经是完整Python/网页平台；应接入必要的后端能力，避免只做一个通用聊天框。文档解析、模型、检索、长期记忆和题目判分需要分别验收。 |
| **[GEOInflow](https://github.com/yaojingang/GEOInflow)** | 应用源码及项目文档 [MIT](https://github.com/yaojingang/GEOInflow/blob/main/LICENSE)，依赖/地理数据另有许可 | 作者 [@yaojingang 发布帖](https://x.com/yaojingang/status/2114576054018818536)，**2026-10-26**；宣布GEO网站与AI爬虫分析系统、MIT和Docker部署。正文和日期已核验，互动数不可见。 | **AI搜索流量运营台**：网站清单、爬虫访问、页面覆盖、AI引荐和转化；导入日志/站点地图，逐页排查未抓取内容并保留改善记录。 | **中高**。官方服务依赖PostgreSQL、Redis和后台worker；核心统计无需模型key，AI分析可选。浏览器访问与服务器/CDN爬虫日志不同，需真实数据源；“访问过”不能等同被索引、被训练或被模型答案引用。 |
| **[DeerFlow](https://github.com/bytedance/deer-flow)** | [MIT](https://github.com/bytedance/deer-flow/blob/main/LICENSE) | 作者 [@henry19840301 2.0发布帖](https://x.com/henry19840301/status/2026847782456406331)，**2026-02-25（纽约时间；原始嵌入显示UTC 02-26）**；宣布在LangGraph 1.0上重写，包含规划、长期记忆、文件系统和skills。属于历史发布，不是最近90天热度；互动数不可见。 | **研究交付项目室**：研究计划、资料来源、分步产物、可编辑报告与交付检查。把来源、任务阶段和产物放到同一个项目里。 | **高**。当前是含子代理、沙箱和记忆的长期任务系统，Python＋Node后端、多模型和执行环境都需维护。与已有LangGraph工作台重叠较大；更适合后续扩充研究能力，而非下一轮再做同类流程界面。 |
| **[MiroFish](https://github.com/666ghj/MiroFish)** | [AGPL-3.0](https://github.com/666ghj/MiroFish/blob/main/LICENSE) | [@AYi_AInotes 介绍帖](https://x.com/AYi_AInotes/status/2035274445846360123)，**2026-03-21**；原帖正文明确讨论MiroFish，作者/日期已核验。另有[社区实测帖](https://x.com/Metroxe/status/2044496303938539744)，**2026-04-15**，与[仓库Discussion](https://github.com/666ghj/MiroFish/discussions/537)相互对应。均为历史线索，互动数不可见。 | **情景推演实验台**：输入背景材料、编辑角色与假设、设置轮数、观察模拟时间线、比较不同假设的报告。优先创作设定或内部方案讨论。 | **高**。官方部署涉及Python、Node、OpenAI格式模型API及Zep；多代理模拟消耗较高。应展示为“模型情景模拟”，不能把营销中的“预测万物”当作经过验证的预测能力；维护者在Discussion明确表示未复现社区实验或验证其准确性。 |

## 互动量线索的限制

[10月27日《琳小航AI》日报](https://jedeeai.com/daily/)展示过GEOInflow原帖 **687赞／8.8万浏览**、DeepTutor原帖 **829赞／3.4万浏览**。这是第三方采集快照；本次官方嵌入接口无法复核这些数字，不作为已核验的当前互动量，也不用于排序。若需要严格的X热度榜，下一步应在可见的X页面或获授权的X数据接口取同一时点数据。

## 推荐先后

1. **PageIndex**：业务闭环清晰，引用可核查，能形成“报告阅读台”的独立布局；复用现有文档阅览经验，新增真正的页级检索能力。
2. **GEOInflow**：选题很新，与已有工作台差异大；先做日志/内容清单导入与覆盖审查，完成无模型也有价值的运营流程，再接在线采集。
3. **DeepTutor**：用户场景明确，近期仍有功能更新与X讨论；先做课程与错题闭环，避免第一版搬运整个学习平台。

DeerFlow和MiroFish保留为后续候选，主要原因是服务复杂度和首版范围较大，并非只按传播热度做取舍。本轮没有安装上述项目、调用其模型或验证宣传效果。
