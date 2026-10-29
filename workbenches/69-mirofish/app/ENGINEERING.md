# 实现说明

## 数据与校验

- `contracts/scenario.ts`：工作对象类型、常量、`deriveEdges`（由实体关系推导智能体关注图）与 `simInput`（运行输入的独立快照）。
- `contracts/validate.ts`：严格校验（运行、保存依赖的模型）与草稿恢复（允许空名称、越界参数、待修复的智能体来源/事件引用，但结构、大小与图谱关系引用照常检查）；读取 0.5 复核工程时转为只读导入运行（`legacyActions`，首次打开上传进结果库）。完整推演文件可携带未完成工作副本，导入使用草稿恢复校验。
- 项目 900KB 上限决定：本地运行只存输入快照与指纹，结果按输入确定性地重新生成；导入结果存入 `run_results`（迁移 0005），项目只存结果编号与摘要。

## 规则抽取与人设

- `contracts/extract.ts`：按句切分；机构后缀（政府/媒体/学术/社会组织/企业）、群体称谓与“姓+称谓”人物识别，修剪前置虚词、在动词与数量词处截断，合并后缀包含的别名并去掉嵌套名称；同句共现按动词定关系类型；立场词典（含单字否定）估计初始立场；“担心/改善…”句式提出议题要点；确定性力导向布局（保留手动位置）。
- `contracts/personas.ts`：按实体类型给活跃度/影响力/坚持度/平台/活跃时段，影响力随图谱度数加成；群体拆为“积极发声者/观望者/务实派/新加入者”。

## 推演引擎

- `contracts/random.ts`：cyrb53 字符串哈希 + sfc32，浏览器与 Node 一致。
- `contracts/engine.ts`：每轮按模拟时钟（MiroFish 的高峰/工作/凌晨倍率）决定活跃；推荐流按新鲜度 0.4、热度 0.3、关注 0.3 打分并按回音室强度惩罚立场差；阅读时做 Deffuant 有界信任同化，超过阈值 +0.5 时按逆火强度反向；事件注入按对象与触达比例推动立场并可由指定智能体发帖。动作以 MiroFish 原生 `AgentAction` 字段输出（CREATE_POST、CREATE_COMMENT、LIKE/DISLIKE_POST、REPOST、QUOTE_POST、FOLLOW），帖子文本由模板按立场档位、类型口吻与议题要点生成。输出逐轮指标、每个智能体的立场轨迹、事件即时效果与指纹；`robustness` 用派生种子重跑。
- `contracts/analyze.ts`：导入的原生动作做精确活动统计，立场用词典估计并标为 `lexicon`。
- `contracts/report.ts`：规则报告（设定、结论、稳健性、转折、群体分化、关键角色、代表言论、局限）与 CSV（带 BOM）/JSONL/图谱导出。历史本地运行的问题与话题从 `run.input` 读取，研究者备注沿用当前编辑内容。

## 服务端

- `server/results.ts`：`/api/simulate` 按输入哈希缓存结果（幂等）；分片上传 `begin/chunk/commit`，分片按 (upload, seq) 覆盖写入，提交幂等，结果按内容寻址；`contracts/chunks.ts` 按编码体积切分，确保每个请求低于运行时 2MB 限制。
- `server/host.ts`：人设/报告的提示词、输出提取与校验（越界数值钳制、未知实体丢弃、截断拒绝），`HOST_NOT_CONNECTED` 转为可操作说明；路由只在用户点击时调用 `app.host.llm.generateText`。
- `server/mirofish-client.ts` / `run-commands.ts`：沿用 0.5 的官方契约与命令账本；默认地址改为上游 Flask 默认 `http://127.0.0.1:5001`；detail 读取上限 40MB、60 秒；结果通过 `storeActions` 进入结果库并追加为当前推演的运行。
- PDF 文本在浏览器用 PDF.js 按需加载并逐页提取，CMap 由 `pdfjs-assets` 资源经 `/api/pdfjs/cmaps/:file` 提供。读取全部页，累计超过文字容量立即报错，不保留截断结果；浏览器验收包含 501 页文件末页、损坏 PDF 和本地 CMap 资源。

## 界面

`useStudio` 管自动保存工作对象、阶段与选择、结果缓存与载入（本地运行先幂等重算再读取，校验指纹）、导入导出与 MiroFish 通道；`useHostModel` 管模型可用性与建议；各阶段组件只编辑自己的对象。图表为纯 SVG，导出 HTML 时用 `react-dom/server` 按需加载渲染。

加载状态 `loading` 独立于业务失败，不显示“结果没有载入”。HTML 导出与模型深化要求 `report.runId === activeRun.id`，避免旧报告与新运行指标混用；Markdown 可以单独导出已有正文。

## 验证与交付

Node 22.22.0 / pnpm 10.22.0。独立 Chrome profile 运行真实 UI、应用 HTTP 与 SQLite，只对 Host/LLM 提供模拟响应；保存失败、延迟与丢回执通过请求故障注入验证，业务引擎和数据库未替换。预览设置 `FLOATBOAT_HOST_MODE=offline`，官方服务指向不可连接的回环地址，避免发现或调用本机计费服务。端口由运行时绑定 0 分配，结束后关闭本项进程。

证据目录：`archive/2026-10-29-workbench-depth/mirofish`（工作区级，非仓库根目录）。应用测试覆盖确定性引擎、抽取、格式解析、SQLite、命令账本、结果分片与 Host 合同；浏览器证据和功能/结构结论见 `ACCEPTANCE.md`。共享自动保存模块仅验证不改动，check 的大模块提示属于非阻断警告。

包在 REQUIREMENTS、DESIGN、ENGINEERING、ACCEPTANCE 定稿之后生成；`application/` 中代码、文档、锁文件、迁移逐字节比对源目录，manifest 仅允许资源绑定规范化，打包资源另比对内容哈希。最终包哈希记录在项目根的机器验收记录和工作区 archive，避免把包自己的哈希写入包内造成循环。
