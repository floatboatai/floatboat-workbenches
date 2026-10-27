# 写作台

已实现并完成本地验收。富文本写作与粗体/斜体/小标题/列表/引用/撤销重做 → 保存恢复 → JSON/HTML 导出。AI 草稿先预览，确认后替换正文，可放弃生成稿。

在总仓库执行 `pnpm workbench prepare tiptap`，进入本目录执行 `pnpm workbench:check`、`pnpm test`、`pnpm dev`、`pnpm package`。在 Floatboat → My → Workbenches → Import workbench 导入生成包，默认不包含预览数据。

2026-10-27 验收：严格模板构建与 7 项测试通过；Chrome 1440px/375px 输入并加粗→保存刷新恢复→JSON/HTML 导出，导出的 HTML 包含真实 strong 标记。危险链接、非法节点语法、空项目与数据库冲突测试通过。 浏览器无页面异常、CSP 拒绝或失败资源。真实 Floatboat llm.generateText 成功返回中文草稿并停留在预览区，未自动覆盖正文。另明确注入 HTTP 503 验证失败时要求和正文保留；注入结果不作为真实模型成功证据。 打包文件导入客户端的安装流程尚未验收。

边界：支持段落、1–3 级标题、列表、引用、代码块、换行及分隔线。最多 5000 节点、20 层、100000 字符；只接受安全链接协议。当前无图片上传、协作编辑、Word/PDF 导出或任意 HTML 导入。

[上游](https://github.com/ueberdosis/tiptap)；@tiptap/{react,core,pm,starter-kit} 四包精确 3.32.0，root/app 两套清单与锁一致。来源见 [NOTICE.md](NOTICE.md)，设计与实现见 app/DESIGN.md、app/ENGINEERING.md。

自动保存：停止输入约 700 ms 后保存，后台请求不锁编辑。正文、写作要求与待采用生成稿可在刷新后恢复；不合法的业务输入显示“草稿已自动保存，待完善输入”，不会覆盖最后的合法内容。网络失败时保留本机副本，版本冲突提供恢复草稿导出与服务器版本入口。导入先验证，再创建独立项目。

当前布局：正文为中心的写作区与按需展开的助手；375px、暗色与减少动画偏好保持可用。
