# 第 18–27 项实施批次

按每个产品的实际工作方式设计，自动保存及完整草稿恢复为默认能力。10 个独立 agent 任务使用隔离 worktree；环境允许同时运行 3 个子 agent，按完成情况补位。

| 项目 | 用户主任务与验收结果 |
| --- | --- |
| BlockNote | 块式知识页、嵌套内容、JSON/HTML/Markdown 导出 |
| MDXEditor | Markdown 富文本编辑、源码与差异审校、文件往返 |
| Milkdown | Markdown 写作、标签与大纲、可恢复笔记 |
| PDF.js | 本地 PDF 原件阅读、分页/缩放/文本检索与逐页批注 |
| reveal.js | 幻灯片编排、演示预览、演讲备注与网页导出 |
| Univer | 开源 Sheets 网格编辑、公式、CSV/JSON 与表格快照 |
| Vditor | 中文 Markdown 三模式编辑、内容预览与文件导出 |
| Fabric.js | 对象化海报设计、尺寸/层级编辑、PNG/SVG/JSON |
| Filerobot Image Editor | 本地图片裁剪、调整、标注与可恢复编辑状态 |
| GrapesJS | 区块/样式/图层编辑、页面预览与 HTML/CSS/项目导出 |

先交付可独立运行的 18–27 项。12–17 项保留在计划中，它们需要独立服务实例及相应连接条件。

每项在自己的 README、DESIGN、ENGINEERING 和验收记录中明确功能范围、依赖版本、许可、自动保存边界、构建/测试/浏览器结果。浏览器覆盖桌面和 375px、暗色、reduced-motion、主要操作、重新打开、未完成输入、延迟保存和失败恢复。完成后由主 agent 整合截图、catalog 与源包；未经对应验证不改为 local-verified。

本批不声明 Floatboat 客户端导入已验证。现有 16 项保持 0.2.0，本批新应用目标版本 0.3.0。
