# 安装与服务配置

本指南随工作台源码包附带。仓库级命令在[完整仓库](https://github.com/floatboatai/floatboat-workbenches)中执行，外部服务源码与锁文件位于对应项目目录；普通工作台包不包含服务运行环境。

# 群体推演 · MiroFish

把 MiroFish 的群体推演流程做成一个本机可用的工作台：种子资料 → 实体与关系图谱 → 智能体人设 → 推演参数与事件注入 → 运行 → 舆情与立场时间线 → 报告。没有 MiroFish 后端、Zep 或 Floatboat 时，抽取、人设、推演、观察与报告都在工作台内完成；官方后端与 Floatboat 模型是可选通道。

## 使用

```sh
pnpm workbench prepare mirofish
pnpm workbench dev mirofish
```

首次打开是原创示例“滨河市老城区低排放区试行”：4 份资料（征求意见稿要点、日报报道、研究所测算与网络讨论、12345 热线意见汇总，约 2900 字）、17 个实体 24 条关系、26 个智能体、3 次事件注入（听证会延长过渡期、无来源的“营业额下降三成”视频、研究所测算），以及已完成的 36 轮推演和规则报告。示例为虚构场景，不对应真实城市政策。

## 工作流

1. **资料**：写推演问题与话题短名；添加 TXT/MD/HTML/CSV/JSON/PDF（PDF.js 在浏览器提取文字，GB18030 文本自动识别），或直接粘贴，合计 20 万字。可用【名称】或 `[[名称|类型]]` 标注。编辑议题要点（利好/关切）。
2. **图谱**：“从资料抽取图谱”用规则识别机构、群体与人物，按同句动词判断支持/反对/质疑/监管/合作/报道/隶属/竞争/关联，并用立场词典估计初始立场。在画布上拖动、连线、改类型与依据、删除；列表视图可读全部实体与关系。
3. **人设**：按图谱生成规则人设（群体拆成 1–4 个子角色），逐个调整立场、活跃度、影响力、坚持度、平台与 24 小时活跃时段。可选用 Floatboat 模型改写简介与人设文本，确认后才写入。
4. **推演**：设置随机种子、开始时间、平台、轮次（1–240）、每轮分钟、信任阈值、影响速率、回音室、逆火、扰动与阅读条数；按轮次注入事件。“开始推演”在 Node 内运行，同时用 5 个派生种子做稳健性检验；同一输入与种子结果完全一致（记录指纹）。
5. **观察**：舆情构成（点选轮次）、平均立场与极化、群体走势、智能体立场热力条与原生动作时间线。导出逐轮指标 CSV、智能体 CSV、原生动作 JSONL、图谱 JSON。
6. **报告**：按运行生成规则报告（结论、稳健性、转折、群体分化、关键角色、代表言论、局限），编辑 Markdown，导出 Markdown 或含图表的 HTML。可选用模型深化，确认后替换。

文件操作都在“推演档案”：新建空白、打开示例、打开已保存或本机恢复稿、导入、导出 `.mirofish.json` 与恢复稿、删除。导入一律新建推演；导入 MiroFish 原生结果（`run-status/detail`、`actions` 响应、`actions.jsonl`，最大 40MB、10 万条）时分片上传，立场为词典估计并明确标注；JSONL 缺平台时保留原文并让你选择平台后重试。0.5 的复核工程仍可打开，转为只读导入运行。

## 启动官方 MiroFish 后端（可选）

1. `git clone https://github.com/666ghj/MiroFish`，复制 `.env.example` 为 `.env`，填入 `LLM_API_KEY`（OpenAI 兼容接口，可配 `LLM_BASE_URL`、`LLM_MODEL_NAME`）与 `ZEP_API_KEY`。
2. `npm run setup:all`，然后 `npm run backend`（Flask，默认端口 5001）。
3. 在 MiroFish 前端完成资料上传、图谱构建、人设与模拟准备，使模拟处于 `ready`。
4. 地址不是默认值时：`MIROFISH_URL=http://127.0.0.1:端口 pnpm workbench dev mirofish`，在工作台点“重新检查”。

## 可选通道

- **MiroFish 后端**：默认 `http://127.0.0.1:5001`（上游 Flask 默认端口），`MIROFISH_URL` 可改，远程须 HTTPS；`MIROFISH_TOKEN` 仅用于反向代理认证。“推演 → MiroFish 后端”标签显示连接状态、启动四步与“重新检查”；连接后可启动已准备的模拟、停止、核对状态并把结果读入运行记录。启动会调用上游模型与 Zep，可能产生费用。细节见[运行接入](https://github.com/floatboatai/floatboat-workbenches/blob/main/workbenches/69-mirofish/RUN-INTEGRATION.md)。
- **Floatboat 模型**：启动并登录 Floatboat 后自动可用；未连接时相关按钮禁用并在旁说明，规则人设与规则报告照常。

本地推演是基于规则与概率的意见动力学模型，帖子文本由模板生成，用于比较不同假设下的趋势，不是对现实的预测。

打包：`pnpm workbench package mirofish`。导入：Floatboat → 我的 → 工作台 → 导入工作台；客户端导入尚未实测。[验收记录](https://github.com/floatboatai/floatboat-workbenches/blob/main/workbenches/69-mirofish/ACCEPTANCE.md)单列实际范围。上游 MiroFish AGPL-3.0 原文在 `app/notices/`，PDF.js Apache-2.0 许可在 `app/pdfjs/LICENSE`。
