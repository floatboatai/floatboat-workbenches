# Vega-Lite 图表实验台 0.9.0 验收

日期 2026-10-29。功能验收与结构审查分别记录。

## 功能验收：local-verified

### 命令

- `node scripts/workbench.mjs check vega-lite`：manifest、依赖、类型、构建通过（仅保留共享 `autosave-client.ts` 体积提示）。
- `node scripts/workbench.mjs test vega-lite`：20/20 通过。新增覆盖：CSV 引号/转义/引号内换行/CRLF/BOM/空行；类型推断与数值转换、重复/空表头；JSON 对象数组与包装、原型属性拒绝；数据集命名与引用校验；示例数据确定性与真实感范围；13 个示例全部通过官方 schema 并在 Node 中编译、运行（AST interpreter）、导出 SVG；schema 错误归纳（拼写建议、mark/type 可选值合并、深层 `labelAngel`、类型错误）；带位置 JSON 解析与 Pointer 定位；规格分析（schema 错误行号、外部 URL 与未知数据集为警告、schema 未加载不应用）；渲染准备（注入数据集、同名 url 改写、仅单视图补尺寸、不再夹宽度、不改原规格）；字段芯片插入（单视图/图层/分面/拼接/tooltip）；数据集存储（示例幂等、按内容去重、解析失败 422、缺失 404）；GB18030 解码与格式嗅探；分块上传顺序/长度/20 MiB 上限；保存前完整校验与自动保存草稿/正式保存；项目包往返与 Vega 规格、数据数组识别；0.3.0 旧模型兼容；SQLite 持久化与冲突。
- `node scripts/workbench.mjs package vega-lite`：`artifacts/vega-lite-studio-0.9.0.fbworkbench`，66 个文件，不含业务数据。
- 项目根与 `app/` 均 `pnpm install --frozen-lockfile --ignore-scripts` 通过。

### 真实浏览器（Playwright + Chrome for Testing，空数据目录，`FLOATBOAT_HOST_MODE=offline`）

1440×900：

- 首开即渲染种子图（layer：区间面积 + 折线 + 图例绑定参数），数据窗显示 `weather`（1,098 行），服务端 0 个项目；schema 加载后状态“通过 schema”。
- schema 错误：把 `"type": "area"` 改为 `"aera"` → 错误条“规格第 43 行：取值 "aera" 无效，可选：…"area"…”，波浪线在第 43 行，「定位」把光标移到第 43 行；保存状态 draft“规格草稿已自动保存，修正 1 处错误后生效”；导出面板说明原因并禁用 PNG。改回后 saved，正式模型含 2 个图层与 `weather` 数据集。
- 补全/悬停：`"field": ` 处 Ctrl+Space 列出 weather 的 7 个字段（带类型）；`"ag` 补全为 `"aggregate": `；悬停 `mark` 显示 schema 说明。
- 完整语法：粘贴 facet + boxplot 规格直接渲染并保存（旧版会拒绝）。
- 外部资源：`data.url` 为 `https://example.com/cars.json` → 问题列表提醒、图纸上方“已阻止外部资源”，**全程零外部网络请求**。
- 数据窗：空白图表导入 `门店月报.csv`（BOM、CRLF、`""` 转义、引号内换行）→ 36 行 4 列、类型“时间/类别/数值/类别”，含引号的行正确；“设为规格数据”后点芯片放入 x/y/color/tooltip，规格得到对应编码并渲染。GB18030 编码 `城市人口-gbk.csv` 表头与内容正确；`points.json` 导入；`big-orders.csv`（5.3 MB、130,000 行）分 6 块上传约 0.5 秒，按月聚合折线约 0.5 秒绘出；21 MB 文件与 `.xlsx` 在上传前给出明确提示（无报错请求）。四个数据集随图表保存。
- 示例库：13 个缩略图全部绘出；选“门店散点刷选联动”另建图表，在散点上拖动框选后下方柱图从 4 个级别变为选中的 2 个级别（宽度 223/335/506/307 → 541/203）。
- 导出（内容校验）：`@2x.png` 1224×1028，恰为 SVG 612×514 的 2 倍；SVG 有 XML 声明、无外部 href；复制规格与编辑器逐字一致；`.vl.json` 与编辑器一致；编译后 Vega 规格 `$schema` 为 vega v6 且内联 160 行门店数据；项目包含 `stores.csv` 原文 161 行。
- 导入：项目包另建新图表并重新上传数据（项目数 3→4），渲染框选图；官方写法 `data: {"url": "data/sales.csv"}` 先提示已阻止，再在数据窗导入 `sales.csv` 后提醒消失、绘出 4 根柱；Vega 规格给出“这是 Vega 规格，不是 Vega-Lite 规格”。
- 恢复稿下载后导入为新图表并保存；删除图表经确认后项目数 6→5。
- 自动保存契约：第一次 POST 延迟 3 秒期间 phase=saving、名称仍可编辑并继续输入，刷新后保留较新的“延迟保存测试 AB”；回包丢失（服务端提交后中止响应）→ offline → 重试 → saved，项目数 1→1、revision 7→8；无效 JSON 草稿刷新后原文逐字恢复并显示第 42 行错误，phase=draft。
- 控制台：除回包丢失模拟产生的 1 条预期 `net::ERR_FAILED` 外，无控制台或页面错误。

375×812：默认“图表”页签、无横向溢出，单视图图宽 319px；规格页签输入错误后页签出现红点，撤销后消失；数据页签表格可见，字段芯片菜单不越界；导出面板为底部宽弹层；文件对话框宽 337px；从示例新建环形图（半径按容器计算）；AI 状态卡不溢出。

暗色与键盘：首个 Tab 为“跳到规格编辑器”，回车进入编辑器；Escape 关闭文件对话框并把焦点还给「文件」，关闭导出面板并还给「导出」；⌘/Ctrl+S 立即保存；暗色下台面与检查器转深、图纸保持白色。

AI：Host 离线时 /api/app 返回 not-connected，「生成候选规格」禁用，状态卡说明原因与启动方法，「重新检测」更新状态；编辑、示例、导入与导出不受影响。**未进行真实 Host 模型调用**。

脚本、日志与截图：`scratchpad/wave-vega-lite/`（不入库）。

### Web Interface Guidelines

2026-10-29 获取最新规则后复核改动源码：表单与图标按钮命名、可见焦点、跳转链接、对话框 Escape/焦点返回、`overscroll-behavior: contain`、缩略图尺寸与懒加载、表格数字 tabular 与年份列不加千分位、`translate="no"`、`theme-color`/`color-scheme`、移除数据集与删除图表确认、按钮 tap highlight、reduced-motion。字段芯片拖入编辑器另有点按菜单作为替代。

### 限制

- 被移除或不再引用的数据集原文保留在 SQLite 中，暂无回收。
- 数据窗表格只预览前 200 行（图表使用全部数据）；不支持 Excel（.xlsx）直接导入，需另存为 CSV。
- schema 补全对 anyOf 分支取并集，可能列出当前分支不适用的属性；校验错误为启发式归纳，复杂嵌套时可能只指出最深的一处。
- 示例与引导不含 geoshape 地图（需要外部 TopoJSON）。
- 交互参数名需为英文标识符（Vega-Lite 会把中文参数名清洗成重复的信号名）。
- 本地恢复依赖同源 IndexedDB；不同预览端口不共享。
- Floatboat 客户端导入源包与真实 Host 模型调用**未验收**。

## 结构审查：pass（待主代理整合确认）

- 主任务：图表图纸占左上主区（约 65% 宽 × 65% 高），右侧常驻规格检查器，下方为可收起的数据窗；旧版“项目选择器 + 新建/立即保存”页头与“名称/AI/导出/删除”工具条已删除，文件生命周期全部移入「文件」对话框，自动保存状态为名称旁小字。
- 主业务动作贴近对象：导出挂在图纸上沿，错误条贴在图纸上方并跳到规格行，字段芯片在数据旁直接写入规格。
- 对照截图：Mermaid（`docs/screenshots/mermaid.png`）是深色源码与图形等宽对照；CircuitJS 0.8.1（`docs/screenshots/circuitjs.png`）是画布与仪表。本台以图纸为主、规格为检查器、数据为证据窗，空间层级不同。
- 空态与有内容：首开种子图、空白图表（内嵌 3 行）与无数据集空态都可直接编辑或导入；375px 保留同一文件入口与全部生命周期操作。
- 截图：`docs/screenshots/vega-lite.png`（1440×900，空数据目录首开）。
