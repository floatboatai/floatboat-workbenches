# 知识地图需求

用户：维护代码仓库与配套文档的工程师、技术写作者和接手项目的人。主任务：把一批资料变成知识图谱，找到核心对象与模块边界，沿关系链追溯来源，回到原文核对，并留下审阅笔记或交付报告。

1. 无 Python、无 Floatboat 时可从首屏完成：拖入文件夹/多份文件/粘贴文字 → Node 内确定性抽取 → 社区与地图 → 导出文件。可选的 Graphify Python 服务与 Floatboat 模型在操作旁显示状态、启动方式与重新检查。
2. 输入：代码（Python、JS/TS/JSX、Go、Rust、Java、Kotlin、C#、C/C++、Swift、Scala、PHP、Ruby、Lua、Shell、SQL）、Markdown、纯文本/RST/org/AsciiDoc/LaTeX、常见配置。单文件 4 MB、3000 个文件、合计 48 MB；依赖/构建目录、锁文件、二进制、压缩代码跳过并说明原因。图谱浏览上限 8000 节点 / 40000 关系，超限明确拒绝。
3. 图谱为 Graphify 原生 node-link：节点 `id/label/file_type/source_file/source_location/community`，关系 `relation/confidence/confidence_score/weight/source_location`；导入的额外字段、并行边、networkx `edges` 别名与数字编号保留。
4. 社区检测（Louvain + 连通性细化）、力导向布局、按社区着色/显隐/只看/改名、节点详情与原文定位、最短路径（可忽略方向）、节点检索与原文全文检索。
5. 导出 graph.json、GraphML、HTML 报告、Markdown 报告与完整项目；导入 graph.json、完整项目、恢复稿与 0.5 版项目，均新建知识地图。
6. 自动保存工作稿：资料清单、图谱引用、社区命名、显隐、笔记、固定位置、选择与路径；未完成的粘贴文字与 graph.json 工作稿作为草稿保存。原文与图谱按内容地址存放，项目只保存引用。
7. Floatboat 模型只用于社区命名，发送前说明内容（成员名称/类型/文件/摘要，不含原文），用户点击后才发送；测试只用模拟 Host。

## 交付与验收边界（0.9.0，2026-10-29）

- 交付内容包含可离线完成的文件夹/文件导入、确定性抽取、审阅与报告导出。内置代码抽取是词法与结构启发式解析，不承诺与完整编译器或 tree-sitter AST 等价；Python 适配器为可选增强。
- 自动保存验收覆盖延迟回执期间继续编辑、服务已提交但响应丢失、无效 JSON 草稿恢复、导入为新地图及并发冲突。正在应用的 JSON 或正在抽取的粘贴文本不得清空请求发出后的新输入；旧地图的异步结果不得写入新地图。
- 完整项目导出包含原文与图谱，适合迁移；恢复稿包含工作副本和内容地址，需要原预览的内容库。浏览器本机草稿恢复限同一来源。源包不携带预览数据库。
- 1440px 与 375px 分别走通地图审阅和文件生命周期。真实 Floatboat Host、LLM 与客户端安装不在本次验收范围；模型通道仅合同模拟。
- 包由文档定稿后的源码生成，逐文件核对 `application/` 与 `app/`，允许模板规范化 manifest resources。当前证据以 `ACCEPTANCE.md` 为准。
