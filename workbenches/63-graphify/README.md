# 知识地图 · Graphify

把一个代码仓库或文档文件夹（代码、Markdown、文本与配置）变成可浏览的知识图谱：在本机 Node 内抽取符号、导入、调用、继承、标题、链接、术语与共现，按 Louvain 社区着色，沿最短关系链追溯，点节点回到原文所在行，并导出 Graphify 原生 `graph.json`、GraphML 与自包含 HTML 报告。无需 Python、无需 Floatboat 即可完成。

![知识地图](../../docs/screenshots/graphify.png)

## 使用

```sh
pnpm workbench prepare graphify
pnpm workbench dev graphify
```

首屏是示例资料集「门店补货助手」：17 份 Python/TypeScript 代码、架构说明、ADR、运维手册与周会纪要，抽取后 131 个节点、301 条关系、6 个社区。

- **添加资料**：拖入文件夹或多份文件，或「选择文件夹…」「选择文件…」「粘贴文字」。`node_modules`、`dist`、`.git` 等依赖与构建目录、锁文件、二进制和压缩代码自动跳过并列出原因。单文件 4 MB、一次 3000 个文件、合计 48 MB；原文按内容地址存入本机 SQLite，分片上传。
- **抽取**（确定性，不调用模型）：
  - 代码：Python 缩进作用域；JavaScript/TypeScript（含 JSX）花括号作用域、类方法、箭头函数、接口与类型；Go、Rust、Java、Kotlin、C#、C/C++、Swift、Scala、PHP、Ruby、Lua、Shell、SQL 的定义。相对导入解析到资料中的文件（`.js`→`.ts`、`index`、Python 包），其余成为外部模块；调用按同文件→导入→全库唯一名解析，`self`/`this` 方法、继承与实现；`NOTE/WHY/TODO` 注释成为设计理由节点。
  - Markdown 与文本：标题层级（ATX、Setext、RST 下划线、`一、`/`1.`/`第X章`、org、AsciiDoc）、相对链接与锚点、`[[wiki]]`、行内代码与代码块对符号的提及、文件名提及；粗体/「」/“”标记的术语在两处以上出现时成为术语节点，同段落反复共现的术语相连。
  - 关系带 Graphify 的 `confidence`（EXTRACTED / INFERRED / AMBIGUOUS）、分数、权重与来源行。
- **社区**：多层 Louvain + 连通性细化（每个社区在原图中连通），确定性编号；按社区着色、显隐、只看、改名。重新抽取后人工或模型命名按成员重合度迁移。
- **地图**：d3-force 力导向布局，社区各自聚拢；拖动节点固定位置（随工作稿保存），Alt＋方向键微调，方向键在相邻节点间移动，Enter 打开原文；滚轮缩放、拖动平移、适配视野、重新布局。
- **详情与原文**：类型、社区、摘要（docstring/JSDoc/首段）、按关系分组的邻居、关系所在行；原文视图定位并高亮定义范围，可跳到同文件其它节点。审阅笔记独立保存，节点消失后笔记保留在「已不在当前图谱」中。
- **路径与检索**：任意两点的最短关系链（可忽略方向），逐步显示关系；按名称、编号、文件、摘要检索节点，或在全部原文中逐行搜索并跳到该行。
- **导出**：`graph.json`（Graphify node-link，含 `community` 与 `community_labels`）、GraphML（Gephi/yEd/Cytoscape）、HTML 报告（当前布局的 SVG 地图、社区筛选、节点详情、核心节点、意外关联、资料表；单文件、无外部资源）、`GRAPH_REPORT.md`、完整项目（含原文、图谱、笔记与未完成输入）。
- **导入**：Graphify/networkx `graph.json`（缺社区时本地检测）、完整项目、恢复稿与 0.5 版项目，均新建知识地图。

### 可选增强

- **Graphify Python 服务**（tree-sitter AST）：在「资料 → 抽取引擎」中显示连接状态、启动方式与“重新检查”；连接后代码文件交给上游 `graphifyy==0.9.97` 抽取，文档与文本仍由内置抽取，二者合并后再做社区检测。

  ```sh
  cd workbenches/63-graphify
  uv venv .local/python --python 3.12
  uv pip install --python .local/python/bin/python -r service/requirements.lock.txt
  .local/python/bin/python service/server.py --port 8781
  ```

  地址可用工作台服务进程的 `GRAPHIFY_SERVICE_URL` 配置（默认 `http://127.0.0.1:8781`，只接受本机 http 或 https）。服务只解析不执行源码，每次请求用新解释器与临时目录。
- **Floatboat 模型命名社区**：在「社区 → 模型命名」中先说明将发送的内容（每个社区最多 12 个代表节点的名称、类型、文件与一句摘要，不发送原文），未连接时给出状态与“重新检查”。只替换自动名称，人工名称不变。

不是 Graphify Cloud，不包含语义文档/图像模型抽取、跨仓库常驻同步或全部 CLI 命令。导入内容只作为文本解析，不执行。

## 检查与交付

```sh
pnpm workbench check graphify
pnpm workbench test graphify
pnpm workbench package graphify
```

Python 服务测试：用上面的解释器在 `service/` 中运行 `-m unittest discover -s . -v`。

`.fbworkbench` 为应用源码包，导入：Floatboat → 我的 → 工作台 → 导入工作台。包不含 Python 环境、预览数据或用户文件。客户端导入尚未验证。验收证据见 [ACCEPTANCE.md](ACCEPTANCE.md)。

上游：[Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify)（锁定 `graphifyy==0.9.97`，Apache-2.0 及历史 MIT 部分）；d3-force/d3-quadtree（ISC）。许可与说明随源码包在 `notices/` 提供。
