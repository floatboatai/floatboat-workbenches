# API 参考台

版本 0.1.0，本地与真实 Host 模型调用已验证；Floatboat 客户端导入未验收。

从总仓库运行 `pnpm workbench prepare swagger-ui`，然后 `pnpm workbench dev swagger-ui`。

编辑或导入 OpenAPI 3.0/3.1 JSON，点击「应用 JSON」更新真实 Swagger UI 参考文档，再保存项目。支持重新打开、重命名、删除、JSON 导出和版本冲突保护。错误 JSON 保留原文；未应用草稿在离开/切换/覆盖前提示，避免丢失修改或误导出旧规格。

「Try it out」只支持同源 GET，内置 `/api/demo/health` 可直接执行。外部 servers 与远程 $ref 不支持，无请求代理；授权信息不随项目保存。AI 起草返回候选，检查后明确采用。

## 已验证

`pnpm test` 4 项通过：业务校验、真实 SQLite 保存/冲突/删除、远程引用和服务器限制。Chrome 实测官方 Swagger UI 渲染、同源 GET 返回成功、保存刷新恢复、JSON 导出、无效 JSON 恢复和真实模型候选生成/采用。1440/375px、暗色、reduced-motion 无页面横向溢出；页面异常、console error、失败请求均 0。

Swagger 官方浏览器包在同源 iframe 中运行，双向消息核对 origin/source；父页面保持 React 19.2.3，CSP 不包含 unsafe-eval。

运行 `pnpm workbench package swagger-ui` 生成 artifacts/swagger-ui-studio-0.1.0.fbworkbench。通过 Floatboat「我的→工作台→导入工作台」安装。

上游与许可见 [NOTICE.md](NOTICE.md)。
