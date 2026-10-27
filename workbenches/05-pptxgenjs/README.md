# 演示编排室

当前版本：**0.2.0**（自动保存与产品化布局）。
已实现并完成本地验收。逐页编辑标题、页眉、要点与演讲备注 → 添加/删除/前后排序 → 三主题舞台预览 → 保存恢复 → 真实 PPTX 下载。JSON 可导入恢复。AI 大纲先预览、确认后采用。

在总仓库执行 `pnpm workbench prepare pptxgenjs`，进入本目录执行 `pnpm workbench:check`、`pnpm test`、`pnpm dev`、`pnpm package`。在 Floatboat → My → Workbenches → Import workbench 导入生成包，默认不包含预览数据。

2026-10-27 验收：严格模板构建与 7 项测试通过；Chrome 1440px/375px 添加/删除/排序→保存刷新恢复→PPTX/JSON 导出。解压验证 3 页 OOXML 顺序、中文正文和备注。LibreOffice 能打开并转 PDF；渲染验收使用 Noto CJK 替代 Microsoft YaHei。 浏览器无页面异常、CSP 拒绝或失败资源。真实 Floatboat llm.generateText 返回 3 页中文大纲并停留在待采用区，未自动替换页面。另明确注入 HTTP 503 验证输入与页面保留；失败注入与真实 Host 成功分开记录。 打包文件导入客户端的安装流程尚未验收。

边界：1–30 页、唯一页面 ID，标题 1–80 字、页眉 60 字、备注 4000 字。每页最多 7 个要点，每行约 35 个汉字/70 个英文字母，超限需缩短。当前为标题+要点版式，无图片、动画、自由拖放或 PPTX 反向导入。PPTX 不嵌入字体，接收端需要中文字体。

[上游](https://github.com/gitbrent/PptxGenJS)；pptxgenjs 精确 4.0.1，root/app 两套清单与锁一致。来源见 [NOTICE.md](NOTICE.md)，设计与实现见 app/DESIGN.md、app/ENGINEERING.md。

自动保存：停止输入约 700 ms 后保存，后台请求不锁编辑。空标题、超长要点、演讲备注与大纲要求可在刷新后恢复；不合法的业务输入显示“草稿已自动保存，待完善输入”，不会覆盖最后的合法内容。网络失败时保留本机副本，版本冲突提供恢复草稿导出与服务器版本入口。导入先验证，再创建独立项目。

当前布局：黑色演示舞台、真实内容缩略图、右侧页面内容和舞台下方演讲备注；375px、暗色与减少动画偏好保持可用。
