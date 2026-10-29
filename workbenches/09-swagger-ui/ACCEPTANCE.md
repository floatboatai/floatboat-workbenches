# API 参考台 0.9.0 验收

2026-10-29。appId、registryName `swagger-ui-studio`、autosave `storageKey` `swagger-ui-studio`、projects/autosave_drafts 表与 0001–0003 迁移保持不变；本版本无新迁移。旧 `{spec}` 项目读取时升级为 JSON 原文（有测试）。

## 功能验收（local-verified）

检查：`node scripts/workbench.mjs check swagger-ui` 通过（仅共享 autosave-client 大模块提示）；`test` 26/26 通过；`package` 生成 `artifacts/swagger-ui-studio-0.9.0.fbworkbench`（56 个文件，不含业务数据）；根与 app 的 `pnpm install --frozen-lockfile` 均通过。

真实 Chrome（Playwright，`preview --no-watch`，空数据目录，脚本留存于任务 scratchpad `wave1-swagger-ui/`）：

- **首次打开**：无任何外部服务，首屏为图书馆示例；目录点击 POST /books 展开定位；未授权 Execute → 401；Authorize 填 `demo-librarian` 后 Execute → 201，响应体为新图书 JSON，显示请求耗时；localStorage/sessionStorage 中只有活动文档指针，没有凭据。
- **外部代理**：切到 `https://library.example.org/v1` 后 Execute，curl/Request URL 显示真实目标，代理返回“无法解析域名”，文档底部状态卡说明原因。把服务器改为本机临时 HTTP 服务：默认阻止并给出「允许本机与内网目标」按钮；允许后同一请求返回 200 与服务端真实响应；试调面板列出本会话调用（方法、目标、状态、耗时）。Escape 关闭面板后焦点回到「试调」。
- **源码并排**：修改 info.title 后停止输入 → POST /api/autosave → saved，文档与文件条标题同步更新。插入错误 YAML：诊断按行去重列出（首条第 132 行），状态为 draft，文档保持上次有效版本；点击诊断光标跳到第 132 行。刷新：自动打开并排源码，错误草稿与诊断恢复，状态 draft。修正后自动应用、saved。
- **延迟保存**：首个保存请求延迟 2.5 s，期间状态 saving、编辑器可编辑，继续输入 1.4.2；刷新后为 1.4.2。
- **响应丢失**：保存请求已到服务端提交后中断连接 → offline；点「重试自动保存」→ saved；项目数前后一致（空数据目录复跑为 1 → 1，无重复），服务端内容含新版本、格式仍为 yaml。
- **导入导出**：导入 Swagger 2.0 Petstore YAML（含注释）→ 新规格（原规格仍在最近列表），文件条显示 v1.0.7 · Swagger 2.0 · YAML，目录 5 个端点；导出原文与导入文件逐字节一致；另存为 JSON 解析后 swagger=2.0、host、4 个路径、Pet.required 均正确。导入缺 `}` 的 YAML：菜单给出“第 9 行：前面的 { 没有用 } 结束”（指向最后一行内容），“作为源码草稿打开”后编辑器保留原文与诊断，状态 draft。
- **大规格**：生成 400 端点（141 KB）YAML 导入后 0.13 s 内出现文档；目录点击 /items395/{id} 通过 Swagger 虚拟列表定位并展开；在末尾输入后自动保存 200、saved。
- **起草**：Floatboat 已连接时生成按钮可用；模拟 `/api/app` 未连接时显示启动说明卡、生成按钮禁用，其余功能可用。未进行新的真实模型调用。
- **布局**：1440、1100（并排时目录收起）、375 px 均无横向溢出；375 px 目录 → 点击 DEL /books/{bookId} → 自动切到文档且端点在视口内展开；源码页单独显示；规格菜单为对话框，Escape 关闭并把焦点还给「规格」。暗色外框与 reduced-motion 样式已检查。
- **控制台**：正常流程（首屏、试调成功、导入导出、移动端）页面错误与控制台错误为 0。故意制造的场景会出现浏览器网络记录：示例服务真实返回的 401、测试主动中断连接的 ERR_CONNECTION_RESET；代理自身的阻止/DNS 失败以 200 封装返回，不产生错误记录。

## 结构审查

见 `app/DESIGN.md`「结构审查」：自查通过，最终截图 `docs/screenshots/swagger-ui.png`（1440×900，示例服务 201 响应）。结构状态由主线确认后记录。

## 未验证与限制

- Floatboat 客户端导入 `.fbworkbench` 未验收；起草的真实模型调用本轮未执行。
- 外部 `$ref` 不抓取；单规格 750,000 字符上限；OAuth2 授权码/隐式流程未验证；示例服务数据只在内存中。
- 真实公网 API 的成功转发只在测试中以本机 HTTP 服务（允许内网后）与 DNS 失败路径验证，没有调用第三方公网服务。
