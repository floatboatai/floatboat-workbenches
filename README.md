# Floatboat Workbenches

把成熟的 GitHub 项目接入 Floatboat，提供可编辑、可保存、可导出的业务工作台。

一个项目一个目录，按 `catalog.json` 的顺序实现。只有完成实际检查的项目才标记为已实现。其余目录仅记录范围，不代表已经可用。

## 当前进度

**11 / 50 个工作台已完成本地验收**，其余 39 个为计划项目。这里实现的是各上游核心库的工作台集成，具体功能边界以各目录 README 为准。Floatboat 客户端导入流程尚未实测。

| 项目 | 已实现流程 | 界面方向 |
| --- | --- | --- |
| [Excalidraw](workbenches/01-excalidraw/) | 白板编辑、保存恢复、PNG/SVG/源文件导入导出 | 画布 |
| [Markmap](workbenches/02-markmap/) | Markdown 大纲、交互脑图、独立 SVG 导出 | 纸质笔记与双栏图谱 |
| [pdfme](workbenches/03-pdfme/) | 文本/矩形版式设计、中文字段、多页 PDF 导出 | 纸张工坊 |
| [Tiptap](workbenches/04-tiptap/) | 富文本编辑、JSON/HTML 导出 | 专注写作页 |
| [PptxGenJS](workbenches/05-pptxgenjs/) | 幻灯片编排、主题、演讲备注、PPTX 导出 | 缩略图与演示舞台 |
| [React Flow](workbenches/06-react-flow/) | 节点编辑、单链文本变换、实际运行结果 | 流程画布与参数检查器 |
| [SurveyJS](workbenches/07-surveyjs-form-library/) | 问卷设计、填写、答卷保存与导出 | 分阶段表单 |
| [Mermaid](workbenches/08-mermaid/) | 源码绘图、错误恢复、源码/SVG 导出 | 图形工坊 |
| [Swagger UI](workbenches/09-swagger-ui/) | OpenAPI 文档、JSON 编辑、同源 GET 试调 | API 参考台 |
| [Vega-Lite](workbenches/10-vega-lite/) | JSON 图表规格、内嵌数据绘图、SVG 导出 | 规格实验台 |
| [Observable Plot](workbenches/11-observable-plot/) | CSV/JSON 数据、字段映射、三种图表、SVG 导出 | 数据观察室 |

本批 2–11 使用三个独立 worktree 并行实现，再逐项合并。10 项构建、47 项应用测试、3 项公共工具测试和真实浏览器验收通过；详见 [批次验收](docs/batch-02-11.md)。除 pdfme 主流程无需模型外，这一批其余 9 项已完成真实 Host 模型调用。

已安装仓库级 React Best Practices 与 Web Design Guidelines，入口见 `AGENTS.md`。各工作台分别制定设计方案，参见 `docs/design-principles.md`。

行业补充调研：[28 个小众行业候选](docs/research/niche-industry-candidates.md)，覆盖制造、农业、文博、实验室、演出与音乐，含 9 个优先原型方向和 2 个维护/迁站观察项。它们尚未进入实现清单，源码证据、许可证与接入边界分别记录。

## 开发

需要 Node 22.16+（22.x）、pnpm 10.22.0 和 Git。

```sh
pnpm workbench list
pnpm workbench prepare excalidraw
pnpm workbench check excalidraw
pnpm workbench test excalidraw
pnpm workbench dev excalidraw
pnpm workbench package excalidraw

# 批量构建、测试和打包第二批
pnpm batch check --from 2 --to 11
pnpm batch test --from 2 --to 11
pnpm batch package --from 2 --to 11
pnpm test:tooling
```

准备命令从官方仓库获取 `template.lock.json` 固定版本的工具链，并安装锁定依赖。SDK、编译器、缓存和本地数据不提交到此仓库。业务代码保存在对应工作台的 `app/` 中。

每个应用独立维护 manifest、依赖锁、SQLite 迁移、测试及验收记录。启动预览后使用终端打印的完整地址。生成的 `.fbworkbench` 位于该项目的 `artifacts/`，可通过 Floatboat 的「我的 → 工作台 → 导入工作台」导入。

继续实现计划项目时运行 `node scripts/init-workbench.mjs <slug>`；缺少模板缓存会自动获取锁定版本，已存在的应用及身份不会被覆盖。然后按 `AGENTS.md` 补齐设计、业务代码和验收。批量命令与日志位置见 [开发说明](docs/batch-commands.md)。

## 许可

上游项目、商业扩展和模板 SDK 的许可分别适用。参考各工作台 README、`notices/` 与 `docs/licensing.md`。本仓库尚未选择覆盖所有项目的统一开源许可证。
