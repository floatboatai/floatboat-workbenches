# 第二批工作台

范围：catalog 编号 2–11。已完成实现、本地验收与源包导出，状态为 `local-verified`。三个 Git worktree 并行开发，主仓库已合并；worktree 保留用于后续批次。

| Worktree | 项目 |
| --- | --- |
| visual | Markmap、React Flow、SurveyJS |
| office | pdfme、Tiptap、PptxGenJS |
| data | Mermaid、Swagger UI、Vega-Lite、Observable Plot |

每个项目必须使用相应上游核心库，完成独立业务流程、SQLite 持久化与版本冲突保护、可用的导出或结果交付。模型失败不能替换为伪造结果。

应用源码在自己的目录中，可复用存储和网络逻辑；设计和核心交互分别实现。安装固定依赖并维护两份锁文件。每个项目分别通过类型/构建、业务测试、浏览器主流程、窄屏与错误状态检查，再生成源包。

各 agent 只修改负责的项目目录并提交自己的分支。root catalog、根 README 与批次验收记录由集成者维护。Host 导入没有实测时继续标明未验证。

## 验收结果

集成验收时间：2026-10-27。Node 22.22.2、pnpm 10.22.0，使用 template.lock.json 锁定的官方工具链。主仓库统一执行 `pnpm batch check/test/package --from 2 --to 11`，三个命令均为 10/10 通过；应用测试合计 47 项。`pnpm test:tooling` 另有 3 项通过。

| 工作台 | 测试数 | 浏览器验证的核心交付 |
| --- | ---: | --- |
| Markmap | 3 | 编辑、持久化重开、Markdown/SVG 下载，独立 SVG 的尺寸与完整节点 |
| pdfme | 6 | 设计坐标变更、填写/设计往返、中文与双页 PDF 的文本解析和栅格检查 |
| Tiptap | 6 | 富文本及粗体、持久化、JSON/HTML 下载，HTML 中的实际 strong 标记 |
| PptxGenJS | 5 | 增删排序、备注、3 页 PPTX，OOXML 顺序及 LibreOffice 打开渲染 |
| React Flow | 6 | 4 步单链执行、真实中间值与结果、无效拓扑拒绝、配置与结果导出 |
| SurveyJS | 5 | 设计、填写、必填检查、答卷保存/重试去重、历史快照与 JSON 导出 |
| Mermaid | 3 | 实际图形、源码/SVG 导出、错误语法保留编辑内容并暂停旧图导出 |
| Swagger UI | 4 | 真实参考文档、同源 GET 成功、规格保存/导出与 JSON 草稿保护 |
| Vega-Lite | 4 | 严格 CSP 下实际渲染、规格/SVG 导出、未应用 JSON 的取消与离开保护 |
| Observable Plot | 5 | CSV/JSON、字段与图形切换、数据/SVG 导出、导入覆盖取消保护 |

所有项目分别在桌面与 375px 窄屏检查。浏览器验收包含保存刷新恢复、失败状态及导出；深色和 reduced-motion 按各项目记录验证。除 pdfme 无需模型外，9 个项目真实 Host 生成均返回 HTTP 200，生成稿保持待采用状态。注入的 HTTP 503 仅用于失败回归，不作为真实服务成功证据。

## 集成修复

- 新仓库克隆后初始化项目会自动获取固定模板；重复初始化保留身份与用户源码。
- 检查、测试、打包子进程被中断时返回失败，只有主动停止开发预览可正常结束。
- 保存请求成功、后续列表刷新失败时仍保留成功状态，立即更新列表摘要与版本。SurveyJS 的填写流程及主仓库 Markmap 都做过真实浏览器故障注入：一次创建、一次更新、两次列表 503，最终版本为 2，重新打开内容完整，没有重复创建。
- React Flow 的 AI 配置不接受伪造运行记录；Vega、Swagger、SurveyJS 保留未应用 JSON 草稿；Plot 文件导入前检查最新未保存状态。

## 使用范围

Floatboat **客户端安装/导入仍未验收**；本地浏览器和真实 Host 调用通过不能替代该项。

React Flow 当前只执行单链文本变换；Swagger UI 只允许同源 GET；SurveyJS 在当前工作空间收集答卷，无公开分发链接。pdfme 支持空白纸张上的 text/rectangle 模板，不含任意 PDF 原文编辑或 CSV 逐行映射。PPTX 不嵌入字体，接收端需要中文字体。其余格式、数量限制和第三方许可见各项目 README/NOTICE。

源包包含应用源码、锁文件、迁移及必要浏览器资源，不携带 node_modules、SDK/编译器、本地数据库或预览数据。每包身份、文件哈希和源码一致性已核对。详细命令输出留在本地 `.cache/batch/`；分项目浏览器证据保存在对应 worktree 的 `.cache/`，汇总交付附带校验清单。
