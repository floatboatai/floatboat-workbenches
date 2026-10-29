# Agent-Reach 0.9.0 验收

日期：2026-10-29。Node 22.22.2、pnpm 10.22.0、Chrome for Testing（Playwright 1.56.1，headless）。本机网络经 `HTTPS_PROXY=http://127.0.0.1:7897`；Floatboat 桌面端在运行（预览报告 `HOST_CONNECTED`）。

## 功能验收：local-verified

### 构建与测试

- `node scripts/workbench.mjs check agent-reach`：manifest、依赖锁、类型与构建通过（保留共享 autosave-client 和 useResearchDesk 的体积提示）。
- `node scripts/workbench.mjs test agent-reach`：34 项通过。新增 21 项：公网地址过滤（回环/私网/链路本地/CGNAT/映射/NAT64）、URL 规范化、DNS 解析后拒绝、重定向到字面私网地址与私网域名均被拒、类型/体积/超时/gzip/GBK 解码、HTTP 代理转发与代理下的私网拒绝、代理与 NO_PROXY 选择、GitHub 仓库/README 截断/缺 README/Issue 评论/限额、V2EX 主题与回复、Jina 解析与反爬识别、Exa 文本与 JSON-RPC 错误、Readability 提取（去导航/页脚/脚本，保留标题与列表）、Jina→直接读取回退与尝试记录、采集信封、示例调研有效性与报告、概括材料边界、导入保留概括草稿。
- `node scripts/workbench.mjs package agent-reach`：`agent-reach-studio-0.9.0.fbworkbench`，57 个文件，不含业务数据；摘要见 acceptance-evidence.json。

### 真实浏览器主流程（空数据目录，1440×900）

1. 首次打开：示例调研 4 条来源、选中 sqlite.org 文档、摘录夹 3 条；页面加载只请求本机 `/api/projects`、`/api/autosave/list`、`/api/autosave/recent`，没有外部请求。
2. 导出示例报告：文件内容含“已核对 2 · 待跟进 1 · 未核对 1”与引用原文。
3. 修改来源判断 → 自动保存 → 刷新恢复。
4. 真实 GitHub 仓库搜索（预填 wa-sqlite）：收件区 5 条，收藏 1 条。
5. 去重：再次读取 `github.com/sqlite/sqlite-wasm`，收件区标“已在目录”且默认不勾选；强行勾选收藏后提示保留原笔记，目录数量不变。
6. SSRF：直接读取预览自身地址，收件区显示 `BLOCKED_ADDRESS` 中文说明，没有 “fetch failed”。
7. 真实网页阅读（MDN OPFS 页面，经 Jina）并收藏。
8. 选中正文 → 摘录选中文字 → 写说明 → 加入摘录夹；虚构句子被拒（提示逐字一致），改为原文片段后接受且错误消失。
9. 审阅状态改为待跟进，筛选数量正确。
10. **真实 Host 模型调用**：检查连接为可用，对默认勾选的已审阅来源与一个问题生成概括草稿（`gemini-2.5-flash-lite`，带［编号］），插入研究小结并标注未经核对。
11. 导出完整项目（6 来源、5 批采集、extra 含未完成摘录与问题）、Markdown 报告（统计、小结、编号摘录）与单条原生结果（`schema_version:1`，backend `jina`），均读取文件内容核对。
12. 0 个 pageerror / console error。

其它真实上游调用（同日，经本采集器）：网页直接读取 sqlite.org（Readability，42K 字）、Exa 网页搜索（6 条）、GitHub Issue 读取、GitHub 搜索、V2EX 今日热门；示例调研即由这些结果生成。

### 自动保存与文件生命周期

- 延迟保存期间继续输入：第一次保存被挂起时继续打字，刷新后新旧文字都在。
- 服务器已提交但回执丢失：显示“草稿已暂存本机，连接恢复后重试”，自动重试后已保存，项目数不变，刷新后文字在。
- 未完成编辑恢复：未加入的摘录草稿、采集条链接、语法错误的原生 JSON 工作稿在刷新后原样恢复；错误 JSON 应用时提示“JSON 语法有误”。
- 导入导出的完整项目创建新调研（项目数 +1）；导入 Agent-Reach 原生 JSON 创建新调研并收藏 1 条。
- 新调研显示空态（目录与阅读区均有引导）；改名后自动保存；从「最近调研」切回原调研。
- 「调研」菜单 Escape 关闭且焦点回到菜单按钮。

### 失败状态

- Host 离线（`FLOATBOAT_HOST_MODE=offline`）：概括按钮停用，检查后显示“未连接 Floatboat。启动 Floatboat 桌面端后重新检查”，研究小结照常自动保存；`POST /api/summarize` 返回 503 与中文说明。
- 网络不可达（代理指向关闭端口）：GitHub 与网页阅读返回 `NETWORK · 对方拒绝连接（ECONNREFUSED）`，网页阅读记录 Jina 与直接读取两次尝试。
- 未接入渠道/动作返回 400 中文说明；`169.254.169.254` 等地址返回 `BLOCKED_ADDRESS`。

### 375px

页面宽度 375、无横向溢出；「目录 · 原文 · 摘录夹」切换可用，在目录选中来源后自动切到原文；调研菜单成为整宽对话框；摘录在原文中高亮且可定位。

## 结构审查：passed（改版后真实截图）

- 去掉了 0.5.0 的深色搜索横幅与“项目下拉 + 新调研/导入/项目”页头组合。顶栏只有「调研」菜单、调研名、安静的保存状态与唯一交付动作「导出报告」。
- 主工作区是三栏资料桌：左目录（采集条与收件区紧贴目录）、中原文（约占 50% 宽度，摘录高亮）、右摘录夹。文件生命周期全部在「调研」菜单。
- 与 Oasis（居中单纸张 + 文稿菜单）和 DeerFlow（流程步骤 + 交付纸张）对照：本工作台以来源原文与证据摘录为核心对象，主操作“摘录选中文字”和审阅状态紧贴正文，采集紧贴目录。
- 截图：`docs/screenshots/agent-reach.png`（1440×900，真实运行页面，示例调研 + 真实 GitHub 搜索收件区）。

## Web Interface Guidelines

App/Collector/SourceList/Reader/Folder/FileMenu/Dialog/style.css：通过。图标按钮均有 aria-label；分段控件改为 aria-pressed 按钮；摘录夹标签页支持左右方向键；表单字段有 label/name、链接与代码输入关闭拼写检查；占位文字以“…”结尾；对话框 Escape/焦点循环/焦点返回、`overscroll-behavior: contain`；删除来源与摘录需确认；日期用 `Intl.DateTimeFormat`；`prefers-reduced-motion` 关闭过渡与定位动画；宽屏页面不滚动、各栏独立滚动；深色模式使用同一套 token（未截图验证）。

## 未验证与限制

- Floatboat 客户端导入 `.fbworkbench` 未实测（hostImport: unverified）；Host 模型只验证了本机当前默认模型的一次真实调用。
- 需要登录或浏览器会话的渠道未接入；Reddit 在上游 1.6.0 走 OpenCLI 浏览器，没有免登录 JSON 路径，因此未加入。
- 只支持 `http://` 代理（不支持 SOCKS）；代理模式下目标地址仍在本机解析检查，本机 DNS 无法解析的域名会被拒绝。
- 网页直接读取不执行脚本，纯前端渲染的页面可能只取到很少正文（会提示“可能需要脚本渲染”），可改用“阅读网页”经 Jina。
- 单项目 880KB（平台单项目 900KB），长网页较多时需要分拆调研。
- IndexedDB 恢复限同一浏览器来源；跨设备请导出完整项目。
