# Mermaid 图形工坊

版本 **0.9.0**。Mermaid 源码 IDE：左侧带行号、语法高亮、补全和行内错误标记的源码编辑器，右侧可缩放平移的图形预览。编辑后自动保存，不需要 Floatboat Host 即可完成编辑、模板、导入和导出；只有 AI 起草调用 Host 模型。

![Mermaid 图形工坊](../../docs/screenshots/mermaid.png)

## 0.9.0 能做什么

- **源码编辑**：CodeMirror 6 编辑器，自写的 Mermaid 流式高亮（图类型、关键字、连线、标签、注释、frontmatter/指令），关键字补全、括号配对、搜索（⌘/Ctrl+F）、撤销历史按文件隔离。⌘/Ctrl+S 立即保存。
- **错误定位**：`mermaid.parse` 的错误位置（jison `hash.loc` 或 langium 消息中的行列）按 Mermaid 预处理规则映射回原始源码，扣除 frontmatter、`%%{}%%` 指令和注释行；编辑器波浪线 + 行号槽标记、预览顶部错误条与状态栏同时显示，可一键跳到行列。出错时保留上一版图形（变淡），图片导出暂停并说明原因。
- **真实的安全边界**：渲染使用 `securityLevel: 'strict'`；不再用正则拦截 `image:` 字样，`A[Docker image: nginx]` 正常保存。只拦截真正会联网的写法——节点元数据 `@{ img: "https://…" }`、样式行/指令/frontmatter 中的 `url(…)` 与 `@import`。这些写法在渲染前被移除（不发出网络请求），编辑器以警告标出所在行，文件保存为工作草稿；输出 SVG 再经 DOM 净化（去脚本、事件属性、外部引用与 CSS 外链）。`data:` 内嵌位图允许。
- **导入**：`.mmd/.mermaid/.txt` 与 Markdown（提取 ```` ```mermaid ````、`~~~mermaid`、`:::mermaid` 代码块；多个代码块时选择其一），也可拖入窗口。导入总是新建图形，不覆盖当前文件；名称取 frontmatter `title`、Markdown 小节标题或文件名。上限 4 MiB 文件 / 100,000 字符源码。
- **模板库**：17 个真实业务示例并带实时缩略图——流程图、时序图、类图、状态图、ER、甘特、思维导图、时间线、饼图、象限图、用户旅程、Git 分支图、架构图、XY 图表、桑基图、看板、需求图。
- **外观**：主题（默认/中性灰/深色/森林绿/基础）与风格（标准线条/手绘草图）按文件保存；源码内的 frontmatter/`%%{init}%%` 主题设置优先。
- **预览**：拖动平移、Ctrl/⌘+滚轮缩放、+ − 0 与方向键、双击或「适应」铺满、「100%」实际尺寸。
- **导出**：PNG 1×/2×/4×（超大图自动降倍并提示）、透明背景、复制 PNG 到剪贴板；SVG 下载（带背景色与 XML 声明）及复制 SVG 代码；`.mmd` 源码与 Markdown 代码块。文件名去除 `/ \ : * ? " < > |`、控制字符和 Windows 保留名。导出设置随文件保存。
- **文件菜单**：左上「文件」集中新建空白、从模板新建、导入、最近图形（含本机/待完善草稿）、下载源码、下载/导入恢复稿、删除。页面不再有项目选择器 + 新建/立即保存 页头组合。
- **AI 起草**：Host 已连接时生成候选稿，确认后采用（保留主题与风格，可撤销）；未连接时按钮旁显示状态卡（原因、启动方法、重新检测），其余功能不受影响。

## 运行

从总仓库运行 `pnpm workbench prepare mermaid`、`pnpm workbench dev mermaid`。本目录执行 `pnpm workbench:check`、`pnpm test` 与 `pnpm run package`。无 Host 的本地验收可用 `FLOATBOAT_HOST_MODE=offline node tooling/cli.mjs preview --no-watch`。

## 验收

功能验收与结构审查分开记录，见 [app/ACCEPTANCE.md](app/ACCEPTANCE.md)。业务测试 14 项（`node --test`）。真实 Chrome（Playwright）在空数据目录、Host 离线下走通：首开渲染、错误行映射与定位、`image:` 文本保存为模型、外部图片不联网且存为草稿、主题/风格刷新保留、延迟保存期间继续输入、回包丢失重试幂等、空源码草稿恢复、.mmd/.md 导入新建、恢复稿导入新建、SVG/PNG/剪贴板/源码导出内容校验、缩放、文件菜单 Escape 与焦点返回、删除、375px、17 个模板全部渲染。Host 已连接时完成一次真实 AI 生成→刷新保留候选→采用。

源包：`artifacts/mermaid-studio-0.9.0.fbworkbench`。通过 Floatboat「我的→工作台→导入工作台」安装。源包不含图形数据；客户端实际导入尚未验收。

上游与许可见 [NOTICE.md](NOTICE.md)。

## 历史

- 0.3.0：快速编辑后撤回到已确认内容时，保存状态和本机工作副本一起恢复。整合验收见 [0.3.0 发布记录](../../docs/release-0.3.0.md)。
