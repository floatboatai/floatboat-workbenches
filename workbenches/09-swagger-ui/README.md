# Swagger 接口参考台

版本 **0.9.0**。打开、阅读并试调真实的 OpenAPI / Swagger 规格；编辑后自动保存。

![API 参考台：端点目录与原生 Swagger 文档，内置示例服务返回 201](../../docs/screenshots/swagger-ui.png)

## 能做什么

- **导入真实规格**：OpenAPI 3.0 / 3.1 / 3.2 与 Swagger 2.0，YAML 或 JSON。保存并导出的是你给出的原文（含 YAML 注释与格式）；另可另存为另一种格式。支持绝对 `servers`、服务器变量、内部 `$ref`、`securitySchemes` / `securityDefinitions`。单个规格原文上限 750,000 字符。
- **端点目录 + 原生文档**：左侧按标签分组的端点目录（方法色与 Swagger 一致、可搜索），右侧官方 Swagger UI 5.34 文档；已开启 Models、`filter`、`deepLinking`、`displayRequestDuration`。点击目录项在文档中展开并定位端点；数百个端点时配合 Swagger 的虚拟列表定位。
- **并排源码**：行号编辑器与实时预览并排。停止输入约 0.4 秒后解析，无错误立即更新文档；有错误时保留为源码草稿，诊断列出行号（点击跳转），文档停在上次有效版本。诊断包括 YAML/JSON 语法、版本/info/paths 结构、找不到的 `$ref`、外部 `$ref`、未声明的路径参数、重复 operationId、未定义的安全方案、相对服务器地址等。
- **任意方法试调**：GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS。外部地址由工作台服务端代理转发（仅在点击 Execute 时发出）；默认阻止 localhost、私有网段、链路本地等目标，用户可在「试调」中为本次会话显式允许；每次连接都检查实际解析地址（防 DNS 重绑定），不跟随重定向，30 秒超时，请求体 ≤ 1 MB，响应 ≤ 5 MB。Authorize 中的令牌只在页面内存中，不写入规格、自动保存、日志或浏览器存储。
- **开箱即用的示例**：首次打开即为「社区图书馆借阅 API」（4 个标签、12 个端点、8 个模型、Bearer 与 API Key 认证、示例值）。第一台服务器是工作台内置的内存示例服务，不需要任何外部服务即可完成 Authorize → 新增图书 → 201。
- **文件生命周期**：左上「规格」菜单集中新建空白规格、导入、打开示例、导出原文 / 另存为、最近规格（含本机草稿）、下载 / 导入恢复稿与删除。导入另建新规格，不覆盖当前内容；有错误的文件可“作为源码草稿打开”继续修正。
- **起草**：连接 Floatboat 时可用模型起草 OpenAPI 候选（以 YAML 显示，确认后才替换源码）；未连接时显示启动说明，其余功能不受影响。

## 运行

从总仓库运行 `pnpm workbench prepare swagger-ui`、`pnpm workbench dev swagger-ui`。本目录执行 `pnpm workbench:check`、`pnpm test` 与 `pnpm run package`。

源包：`artifacts/swagger-ui-studio-0.9.0.fbworkbench`。通过 Floatboat「我的 → 工作台 → 导入工作台」安装；源包不含项目数据。客户端实际导入尚未验收。

验收记录见 [ACCEPTANCE.md](ACCEPTANCE.md)；上游与许可见 [NOTICE.md](NOTICE.md)。

## 限制

- 外部 `$ref`（其它文件或 URL）不会被抓取，需合并到同一文件；诊断会指出位置。
- 单个规格上限 750,000 字符（自动保存请求需同时容纳模型和未通过检查的草稿）；GitHub / Stripe 级别的数 MB 规格无法编辑。
- 内置示例服务的数据只在内存中，服务重启后恢复初始馆藏。
- 试调到被测 API 返回 4xx/5xx 时，浏览器开发者工具会记录一条网络请求失败，这是被测 API 的真实响应。
- 授权值刷新即清除；OAuth2 授权码流程依赖外部浏览器跳转，未验证。
