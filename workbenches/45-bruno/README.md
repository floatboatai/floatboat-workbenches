# Bruno 接口调试台

像 Bruno 一样工作：左侧集合树，中间请求编辑器（Params · Body · Headers · Auth · Vars · Assert · Docs · Bru 源），右侧响应控制台（正文 · Headers · 断言 · 实际请求 · 历史）。改 URL、参数、头或正文后直接点「发送」，原生 `.bru` 源文件自动双向同步。

- **环境与变量**：`environments/*.bru`（官方 `bruToEnvJsonV2`/`envJsonToBruV2`），顶栏切换环境；`{{var}}` 在 URL、头、正文、表单、GraphQL 变量、认证与断言中解析，支持集合/文件夹/请求/运行时变量与 `$randomUUID` 等动态变量。秘密变量只留在页面内存，不写入文件、自动保存或导出。
- **认证**：Bearer、Basic、API Key（头或查询）、继承集合/文件夹认证。
- **正文**：JSON、Text、XML、form-urlencoded、multipart 文本字段、GraphQL。
- **断言**：执行 `assert` 块（Bruno 全部声明式操作符），逐条显示通过/失败；`vars:post-response` 捕获运行时变量。
- **失败分类**：连接被拒绝、DNS、连接超时、TLS 失败是“未送达”，直接重试；只有 POST/PATCH 在响应前中断才是“回执未知”，再次发送前就地确认。
- **历史**：每个请求保留最近 12 次发送，旧记录可从执行记录载入完整正文。
- **首次打开即可用**：示例集合「订单服务 API」指向工作台内置的 127.0.0.1 回声服务（`{{$localEcho}}`）；JSONPlaceholder 示例只在点击发送时访问网络。
- **集合菜单**：新建/打开示例/打开已保存、导入 `.bru`、集合文件夹、Bruno 集合 ZIP 或工程 JSON（均为新副本），导出原生 ZIP、当前 `.bru`、完整工程、恢复稿。

使用官方 `@usebruno/lang@0.41.0` 解析与序列化。`pnpm workbench prepare bruno` 后在此目录运行 `node tooling/cli.mjs preview --no-watch`。验证：`pnpm workbench:check`、`pnpm test`（23 项）。打包：`pnpm run package`；Floatboat → My → Workbenches → Import workbench。默认包不含业务数据，客户端导入尚未验证。

边界：脚本与 tests 原文保留但不执行；其他认证模式、multipart 文件、代理与客户端证书不应用；30 秒超时、响应 2 MiB、重定向不跟随。详见 [SETUP](app/SETUP.md)、[需求](app/REQUIREMENTS.md)、[设计](app/DESIGN.md)、[验收](ACCEPTANCE.md)。

[Bruno upstream](https://github.com/usebruno/bruno) · 原创集成采用范围限定 MIT，依赖保留各自许可。

![接口调试台](../../docs/screenshots/bruno.png)
