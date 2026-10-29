# Vega-Lite 图表实验台

版本 **0.9.0**。编辑后自动保存，不必反复点击保存按钮。

以图表为主的实验台：左上是白色图纸，右侧是 Vega-Lite 规格检查器，下方是数据窗。首次打开就有一张真实的三城气温图和它的数据，无需 Floatboat 即可完成导入、编辑、导出。

## 0.9.0 新增

- **完整 Vega-Lite 6 语法**：`layer`、`hconcat`/`vconcat`/`concat`、`facet`、`repeat`、arc、boxplot、errorband、trail 等全部 mark，以及 transform 与交互参数（框选、图例绑定、滑块）。规格按 vega-lite 包自带的官方 JSON Schema 校验，错误精确到行列并给出可选值和拼写建议；不合法时只保存为草稿，图纸保持上一次有效版本。
- **数据窗**：导入 CSV / TSV / JSON（UTF-8 或 GB18030，单个最大 20 MiB、50 万行），自动推断“数值/时间/类别”，表格预览，字段芯片一键插入 x、y、color 等编码。规格用 `data: {"name": …}` 引用；官方示例里的 `data: {"url": "data/xxx.csv"}` 在导入同名文件后即可直接使用。
- **规格编辑器**：CodeMirror 6，JSON 高亮、折叠、schema 属性与取值补全（含当前数据的字段名）、悬停说明、行内错误与可点击的问题列表。
- **示例库**：13 个带实时缩略图的示例，覆盖图层、拼接、分面、重复、环形图、箱线图、回归/LOESS、滑动窗口、框选联动与滑块参数，附确定性生成的演示数据。
- **导出**：PNG（1×/2×/3×）、复制 PNG、SVG、复制规格、`.vl.json`、编译后的 Vega 规格、项目包（规格 + 数据原文，可再导入）。
- **布局**：去掉固定 900px 宽度上限，单视图随容器自适应；文件生命周期移入「文件」菜单；375px 下为“图表 / 规格 / 数据”页签。

## 安全

Vega 以 AST interpreter 运行（无 eval）；加载器拒绝一切网络、文件和链接访问，只读取本图表导入的数据集，`data:image` 除外。外部 URL 会在编辑器中提醒、在图纸上显示“已阻止”。

AI 拟定使用 Floatboat Host 模型，会看到当前数据集的字段与前三行样例；候选规格经 schema 校验后需人工采用。未连接 Host 时按钮旁给出状态卡与重新检测，其它功能不受影响。

## 自动保存

区分待同步、保存中、已保存、工作草稿、离线和版本冲突。未通过校验的规格原文、数据窗页签、导出倍率与 AI 候选稿都在工作副本中；网络失败保留本机副本并重试；冲突不覆盖服务器版本，可导出恢复草稿后打开服务器版本。导入规格、项目包或恢复稿总是另建新图表。⌘/Ctrl+S 立即保存。

## 开发

从总仓库运行 `pnpm workbench prepare vega-lite`、`pnpm workbench dev vega-lite`。本目录执行 `pnpm workbench:check`、`pnpm test` 与 `pnpm run package`。

业务测试 20 项；真实 Chrome 验收记录见 [app/ACCEPTANCE.md](app/ACCEPTANCE.md)（功能 local-verified，结构审查单列）。

源包：`artifacts/vega-lite-studio-0.9.0.fbworkbench`。通过 Floatboat「我的 → 工作台 → 导入工作台」安装。源包不含项目数据；客户端实际导入与真实 Host 模型调用尚未验收。

上游与许可见 [NOTICE.md](NOTICE.md)。
