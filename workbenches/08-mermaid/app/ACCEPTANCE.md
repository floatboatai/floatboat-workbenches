# Mermaid 图形工坊 0.9.0 验收

日期 2026-10-29。功能验收与结构审查分别记录。

## 功能验收：local-verified

### 命令

- `node scripts/workbench.mjs check mermaid`：manifest、依赖、类型、构建通过（仅保留共享 `autosave-client.ts` 体积提示）。
- `node scripts/workbench.mjs test mermaid`：14/14 通过。新增 `tests/source.test.ts` 覆盖：`image:`/`img:`/`url(...)` 文字不再误判；外部 `img:`、样式/指令/frontmatter `url()`、`@import` 被检测并给出行号；渲染前中和且行数不变；CSS 与引用净化；旧文件默认外观、主题/风格校验、100,000 字符上限；Markdown 代码块提取（反引号/波浪线/`:::`/缩进/CRLF/嵌套栅栏）；frontmatter 标题；安全文件名（路径分隔符、控制字符、保留名、长度）；解析错误行映射（frontmatter + 指令 + 注释 + 空行、jison `hash.loc`、`hash.line`、langium 消息、未识别类型）；17 个模板通过正式校验且覆盖主要图类型。
- `node scripts/workbench.mjs package mermaid`：`artifacts/mermaid-studio-0.9.0.fbworkbench`，49 个文件，不含业务数据。
- 项目根与 `app/` 均 `pnpm install --frozen-lockfile --ignore-scripts` 通过。

### 真实浏览器（Playwright + Chrome for Testing，空数据目录，`FLOATBOAT_HOST_MODE=offline`）

1440×900：

- 首开即渲染种子流程图（含 `构建 Docker image: web:1.8.2` 标签），状态“编辑后自动保存”，服务端 0 个文件；首次编辑后自动创建，正式模型含 `Docker image:`。
- 删除第 8 行的 `]`（前有 3 行 frontmatter）：错误条“第 8 行 Expecting 'SQE' … got 'PIPE'”，波浪线落在第 8 行，「定位」把光标移到第 8 行；导出面板显示“第 8 行有语法错误，修复后才能导出图片”，Escape 关闭并把焦点还给「导出」。
- 追加 `logo@{ img: "https://example.com/logo.png" … }`：编辑器第 23 行警告，状态 draft（“第 23 行引用外部资源…”），预览 SVG 不含该 URL，全程**零外部网络请求**（修复前 Mermaid 在渲染时会请求该图片）。移除后恢复 saved。
- 主题深色 + 手绘草图：保存后刷新仍为 dark/handDrawn，舞台背景随主题变暗。
- 自动保存契约：第一次 POST 延迟 3 秒期间 phase=saving、编辑器保持可编辑并继续输入，刷新后保留较新文本；回包丢失（服务端已提交后中止响应）→ offline → 重试 → saved，项目数 1→1、revision 6→7、内容一致（该中止产生 1 条预期的 `net::ERR_FAILED` 控制台记录）；清空源码 → draft（“请输入图形源码”），刷新后空草稿恢复并显示“源码为空…”。
- 导入：带 BOM/CRLF/frontmatter 的 `架构 草图.mmd` → 新文件“导入的部署图”；两个代码块的 `设计说明.md` → 选择列表（登录时序/第 5 行、数据表/第 19 行）→ 新文件“数据表”（实体关系图）；原文件 revision 与内容不变；无代码块的 Markdown 给出明确错误。恢复稿下载→导入为新文件，forest/handDrawn 随之恢复。
- 导出（标题 `Q3/发布:计划*"终版"`）：`Q3 发布 计划 终版.svg`（XML 声明、无 script、无外部 href、含背景色）；`…@2x.png` 232×572 恰为 SVG 尺寸 2 倍，首像素不透明白；透明 4× `…@4x.png` 464×1144，首像素 alpha=0；复制 PNG 后 `navigator.clipboard.read()` 得到 `image/png`；`.mmd` 与编辑器内容逐字一致；Markdown 代码块剪贴板内容正确；倍率/透明设置刷新后保留。
- 缩放：+ + → 313%，适应 → 200%，100% → 100%；拖动平移；舞台键盘 + + 0。
- 文件菜单：最近图形列表、Escape 关闭且焦点回到「文件」；打开其它文件；模板新建后删除（确认框）4→3；空白图形。
- 17 个模板缩略图与主预览全部渲染成功（桑基图节点名受 Mermaid 词法限制仅支持 ASCII，模板据此使用英文）。
- 键盘：首个 Tab 为“跳到源码”，回车进入编辑器；⌘/Ctrl+S 立即保存；模板库 Escape 后焦点回到「模板库」。

375×812：默认“图形”页签、无横向溢出；源码页签输入错误后页签出现红点、状态栏显示第 4 行错误，撤销后消失；导出面板为底部宽弹层；文件菜单与模板库全宽可滚动；移动端从模板新建思维导图；AI 状态卡不溢出。

AI（两种环境分开记录）：
- Host 离线：/api/app 返回 not-connected，「生成候选稿」禁用，状态卡说明原因与启动方法，「重新检测」更新状态；模板与导出继续可用；无 503 请求、无控制台错误。
- **真实 Host 调用**（本机 Floatboat 已连接）：报销流程提示词 1.6 秒返回 200，10 行 flowchart 候选稿，未采用前源码不变，刷新后候选稿保留，采用后图形同步且主题保持。

除上述预期的网络中止外，各脚本无控制台或页面错误。脚本与截图：`scratchpad/wave1-mermaid/`（不入库）。

### Web Interface Guidelines

2026-10-29 从官方源获取后对改动源码复核并修正：图标按钮命名、表单标签、可见焦点、跳转链接、对话框 Escape/焦点返回、页签 `aria-controls`、代码区 `translate="no"`、`theme-color`/`color-scheme`、对话框 `overscroll-behavior: contain`、缩略图尺寸与懒加载、数字 tabular、省略号文案、删除确认、reduced-motion。状态栏不再作为 live region，避免输入时重复播报；错误条使用 `role=alert`。

### 限制

- 服务端不运行 Mermaid 解析（需要 DOM），语法错误的源码仍可作为正式模型保存，渲染结果单独显示。
- 架构图仅使用 Mermaid 内置图标（cloud/server/database/disk/internet）；不注册联网图标包。
- 源码中 frontmatter/`%%{init}%%` 的主题设置优先于工具条选择（工具条给出提示）。
- 本地恢复依赖同源 IndexedDB；不同预览端口不共享。
- Floatboat 客户端导入源包**未验收**。

## 结构审查：pass（待主代理整合确认）

- 主任务：源码 IDE（38%）与图形舞台（62%）并排占满 1440 视口，下方无页头卡片；文件生命周期全部移入「文件」对话框，旧的“项目选择器 + 新建/立即保存/AI”页头组合与“名称/导出/删除”条已删除；自动保存状态为名称旁小字。
- 主业务动作贴近对象：主题/风格/缩放/导出在预览舞台上沿，错误条贴在舞台顶部并可跳回源码。
- 对照截图：Vega-Lite（`docs/screenshots/vega-lite.png`）仍是“页头项目组合 + 图表/规格/数据窗”，Mermaid 不再使用该页头；CircuitJS 0.8.1（`docs/screenshots/circuitjs.png`）以“实验”菜单承载文件、画布占主区，Mermaid 采用同类“文件”入口但主区是源码与图形两窗对照、错误逐行映射，属于源码 IDE 而非画布。
- 空态与有内容：首开种子、空白图形、空源码草稿均可直接编辑；导入/模板/恢复从首屏一键可达。375px 保留同一文件入口与全部生命周期操作。
- 截图：`docs/screenshots/mermaid.png`（1440×900，空数据目录首开）。
