# 0.9.0 · 让工作台能用、有深度

用户反馈：工作台缺乏深度，部分可能不能使用。[审计](depth-audit-2026-10-29.md)确认：56项构建与测试全部通过，但在空数据目录下实际运行时，14项核心功能依赖未打包的外部服务，多项校验上限拒绝真实文件，多数只露出上游库很小一部分能力，示例接近玩具。0.9.0 分波整改，每项在隔离 worktree 内完成实现、测试、真实浏览器验收与打包，再由主线复核合入。

每项共同验收标准：

1. 空数据、无外部服务、无 Floatboat Host 时，新用户可从首屏完成主任务并得到真实文件；必须外接的能力在主操作旁给出状态、启动方式与重新检查，不再出现原始“fetch failed”。
2. 接住真实输入：去除拒绝普通真实文件的白名单和过小上限。
3. 用已锁定的上游 API 补齐该产品的核心能力，并提供普通、可信的示例资料。
4. 去掉通用页头组合，原生工作对象主导；文件生命周期进入产品自己的文件菜单或资料库。
5. 自动保存契约回归：延迟保存期间继续输入、丢失响应幂等重试、无效草稿恢复、导入新建文档。

功能验收与结构审查分开记录。本轮结构改动均有真实截图；与相邻工作台的正式对照审查仍为待定。Floatboat 客户端导入均未实测。

## 第1波 · 首次打开即不可用或部分不可用的8项

| 工作台 | 之前 | 现在 | 测试 | 真实 Host |
| --- | --- | --- | --- | --- |
| DeepTutor | 核对选择题答案也需要单独的 Python 进程 | 判题、间隔复习、题库导入移入 Node（与原 Python 输出逐项一致）；错题解析与 Host 导师追问；可控出题；12 题示例 | 55 | gemini-3.8-flash |
| FigCraft | 引擎为手动下载的 Rust CLI，首屏 fetch failed、空舞台 | 服务端直接读写 `.figcraft`；近似校样渲染 4 屏 224 节点；文案/名称/填色/交付状态写回；SVG/PNG/交付说明；原生 PNG/PDF 可选 | 14 | 不使用 |
| Bruno | 示例请求必然失败并陷入“回执未知”确认；改 URL 后须先更新源文件；`{{变量}}` 锁死地址栏 | 编辑即发送、Bru 双向同步；环境与秘密变量；认证；全部常用请求体；断言；请求历史；本机回声示例首开 200 | 23 | 不使用 |
| Agent-Reach | 空目录、无示例、采集按钮禁用 | 采集移入 Node（GitHub、网页阅读/直读、网页搜索、V2EX，含 SSRF 防护与代理）；真实示例调研；原文摘录高亮；可选 Host 概括 | 34 | gemini-2.5-flash-lite |
| Swagger UI | 拒绝绝对 servers 与 YAML，真实规格无法导入；仅同源 GET；1 个端点 | OAS 3.x/Swagger 2.0 YAML/JSON 原文保存；并排源码与行号诊断；经代理全方法试调（默认阻止内网）；12 端点示例服务 | 26 | 未重测 |
| Mermaid | 标签含 `image:` 被拒且无法保存；无导入 | 仅拦截真实外部资源；CodeMirror 高亮与逐行错误；17 类模板；主题/手绘；`.mmd/.md` 导入；缩放平移；PNG/SVG/剪贴板 | 14 | 一次真实调用 |
| glTF Transform | 拒绝任何扩展与 >1.4 MB；未做任何 transform | GLB/glTF/ZIP、Draco/Meshopt/扩展，64 MB；分片上传；prune/dedup/weld/simplify 等逐步流水线、撤销与前后报告；贴图、节点、动画；压缩 GLB 导出 | 22 | 不使用 |
| PageIndex | 无服务时连自带示例 PDF 都打不开 | 浏览器 PDF.js 阅读；书签/标题章节树；字符级摘录与引用高亮；检索；Host 原页问答；PageIndex 章节树服务可选 | 21 | gemini-3.8-flash |

每项的验收细节、浏览器流程、导出文件校验与剩余限制见各目录 `ACCEPTANCE.md`。

### 改版对照

左侧为审计基线 `7a0e4ee` 的历史截图，右侧为 0.9.0 真实运行截图。

| 工作台 | 改版前 | 0.9.0 |
| --- | --- | --- |
| DeepTutor | <img src="https://raw.githubusercontent.com/floatboatai/floatboat-workbenches/7a0e4ee6f2d0c22bc3bc70ee53fc4cc9115ab5ac/docs/screenshots/deeptutor.png" alt="DeepTutor 改版前" width="360"> | <img src="screenshots/deeptutor.png" alt="DeepTutor 0.9.0" width="360"> |
| FigCraft | <img src="https://raw.githubusercontent.com/floatboatai/floatboat-workbenches/7a0e4ee6f2d0c22bc3bc70ee53fc4cc9115ab5ac/docs/screenshots/figcraft.png" alt="FigCraft 改版前" width="360"> | <img src="screenshots/figcraft.png" alt="FigCraft 0.9.0" width="360"> |
| Bruno | <img src="https://raw.githubusercontent.com/floatboatai/floatboat-workbenches/7a0e4ee6f2d0c22bc3bc70ee53fc4cc9115ab5ac/docs/screenshots/bruno.png" alt="Bruno 改版前" width="360"> | <img src="screenshots/bruno.png" alt="Bruno 0.9.0" width="360"> |
| Agent-Reach | <img src="https://raw.githubusercontent.com/floatboatai/floatboat-workbenches/7a0e4ee6f2d0c22bc3bc70ee53fc4cc9115ab5ac/docs/screenshots/agent-reach.png" alt="Agent-Reach 改版前" width="360"> | <img src="screenshots/agent-reach.png" alt="Agent-Reach 0.9.0" width="360"> |
| Swagger UI | <img src="https://raw.githubusercontent.com/floatboatai/floatboat-workbenches/7a0e4ee6f2d0c22bc3bc70ee53fc4cc9115ab5ac/docs/screenshots/swagger-ui.png" alt="Swagger UI 改版前" width="360"> | <img src="screenshots/swagger-ui.png" alt="Swagger UI 0.9.0" width="360"> |
| Mermaid | <img src="https://raw.githubusercontent.com/floatboatai/floatboat-workbenches/7a0e4ee6f2d0c22bc3bc70ee53fc4cc9115ab5ac/docs/screenshots/mermaid.png" alt="Mermaid 改版前" width="360"> | <img src="screenshots/mermaid.png" alt="Mermaid 0.9.0" width="360"> |
| glTF Transform | <img src="https://raw.githubusercontent.com/floatboatai/floatboat-workbenches/7a0e4ee6f2d0c22bc3bc70ee53fc4cc9115ab5ac/docs/screenshots/gltf-transform.png" alt="glTF Transform 改版前" width="360"> | <img src="screenshots/gltf-transform.png" alt="glTF Transform 0.9.0" width="360"> |
| PageIndex | <img src="https://raw.githubusercontent.com/floatboatai/floatboat-workbenches/7a0e4ee6f2d0c22bc3bc70ee53fc4cc9115ab5ac/docs/screenshots/pageindex.png" alt="PageIndex 改版前" width="360"> | <img src="screenshots/pageindex.png" alt="PageIndex 0.9.0" width="360"> |

### 主线复核

合入前逐项复核：分支只改动本项目目录与对应截图；在其 worktree 重跑 `check` 与 `test` 全部通过；查看真实截图。各项 `package` 由实现者运行并记录产物哈希。

已知的共性问题：两项实现者独立报告共享 `autosave-client.ts` 在成功保存后切换文档可能误弹“本机缓存尚未修复”确认。该问题在蓝图中统一修复后同步到所有应用，结果另行记录。

## 第2波 · 知名库核心能力补齐（进行中）

PptxGenJS、Tiptap、React Flow、pdfme、CircuitJS、Ray Optics、Oasis Editor、Vega-Lite。
