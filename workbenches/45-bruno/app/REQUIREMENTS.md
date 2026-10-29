# Bruno 接口调试台

使用者在集合树中选择请求，直接修改方法、URL、Query/Path 参数、请求头、正文、认证、请求变量、断言与文档，然后点「发送」（或 ⌘/Ctrl+Enter）。结构化编辑与原生 `.bru` 源文件双向自动同步：结构化修改约 250 ms 后由官方 `@usebruno/lang` `jsonToBruV2` 写入源文件；源文件修改约 400 ms 后由 `bruToJsonV2` 解析，通过即采用，无效时作为草稿保留并就地报错。没有“更新源文件”之类的中间步骤。

**环境与变量**：`environments/*.bru` 用官方 `bruToEnvJsonV2`/`envJsonToBruV2` 读写；顶栏选择环境，环境面板编辑变量表（启用/名/值/秘密）。`{{var}}` 在 URL、Query/Path 参数、请求头、正文、表单字段、GraphQL 变量、认证字段与断言期望值中解析。优先级：运行时变量（vars:post-response 捕获）> 请求 vars:pre-request > 文件夹 folder.bru > 环境 > 集合 collection.bru。内置动态变量 `$randomUUID`/`$guid`/`$timestamp`/`$isoTimestamp`/`$randomInt`/`$localEcho`。`{{process.env.*}}` 不读取。未定义变量在发送前报告具体名称，请求不发出。

**秘密变量**：标为秘密的值只存在当前页面内存；`.bru` 文件只写 `vars:secret [name]`。不进入自动保存、IndexedDB、工程导出、ZIP 或执行记录；发出的请求头/URL/响应正文中出现的秘密值（及其 URL 编码、Base64 形式）在存档前替换为 `•••`。取消「秘密」时当前值写回环境文件。

**认证**：none / inherit（文件夹 → 集合）/ Bearer / Basic / API Key（请求头或查询参数）。其他模式（AWS SigV4、Digest、OAuth2、NTLM、WSSE）原文保留并阻止发送。

**正文**：none / JSON / Text / XML / form-urlencoded / multipart 文本字段 / GraphQL（query + JSON 变量）。非当前模式的正文块保留在源文件中。multipart 文件字段、SPARQL、file 正文阻止发送。GET/HEAD 不带正文。

**断言**：`assert` 块在响应后由服务器评估，支持 Bruno 的 28 个操作符；左侧表达式只按属性路径解析 `res.status`、`res.statusText`、`res.headers.*`、`res.body…`、`res.responseTime`，不执行 JavaScript。结果写入回执并在响应控制台与 Assert 分页显示通过/失败。脚本与 tests 块原文保留、显示提示、不执行，不阻止发送。

**执行与失败分类**：发送先保存含发起记录的工作稿，服务器持久化操作 ID 后才发出 HTTP；同一 ID 幂等返回。连接被拒绝、DNS、连接超时、TLS、fetch 禁止端口、发送前校验失败均为“未送达”的确定失败，直接可重试，无确认。等待响应超时/连接中断/取消：GET/HEAD/OPTIONS/PUT/DELETE 记为失败；POST/PATCH 记为“回执未知”，再次发送前在发送按钮下方就地提示读取回执或确认重发（不使用浏览器 confirm）。页面与工作台服务失联时读取执行记录核对，不重发。服务重启时未完成的记录按方法安全性收尾。30 秒超时（请求 `settings.timeout` 可在 1–120 秒内覆盖），响应正文 2 MiB，重定向不跟随。

**历史**：每个请求保留最近 12 次发送（状态、耗时、大小、断言、环境、实际请求）；较早记录在 320 KB 预算内压缩为摘要，完整正文可从执行记录重新载入。

**本机回声与示例**：工作台进程在 127.0.0.1 随机端口启动回声服务（`/health`、`/status/:code`、`/delay/:ms`、其他路径原样回显方法/路径/查询/头/正文/表单），通过 `{{$localEcho}}` 引用。示例集合「订单服务 API」首次打开即可发送；JSONPlaceholder 公开示例只在显式发送时访问网络。

**文件生命周期**：左上「集合」菜单：新建空白集合、打开示例集合、打开已保存集合、导入（`.bru`/`bruno.json`、集合文件夹、Bruno 集合 ZIP、工程/恢复 JSON，均为新副本）、导出（原生集合 ZIP、当前请求 `.bru`、完整工程 JSON、恢复稿）、立即保存、冲突时打开服务器版本、删除集合。

**预算**：400 个源文件、单文件 200K 字符、模型 780 KB、恢复结构 2 MB、导入原始文件 20 MB；完整自动保存请求受共享 1.95 MB 传输上限约束。
