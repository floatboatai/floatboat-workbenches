# 工程说明

## 模块

| 文件 | 职责 |
| --- | --- |
| `contracts/model.ts` | 业务模型 `{format, source}`、示例与空白规格、`validate`（含 0.3.0 `{spec}` 升级）、模型起草结果转换 |
| `contracts/openapi.ts` | 规格分析：版本/info/paths、端点目录、`$ref`、路径参数、operationId、诊断排序；单条目 LRU 缓存（客户端每次渲染、服务端每次保存都会调用） |
| `contracts/openapi-source.ts` | 语法层：`yaml` 2.8.2 解析（唯一键、别名上限）、JSON.parse + `json-locate.ts` 严格扫描定位、JSON Pointer、行列定位器；连锁 YAML 错误按行去重取前 8 |
| `contracts/openapi-facts.ts` | 认证方案与服务器整理及警告 |
| `contracts/proxy.ts` | 试调代理封装与上限，页面与服务端共用 |
| `server/proxy.ts` | `node:http(s)` 转发；`net.BlockList` 判定私有地址（含 IPv4 映射/NAT64/6to4）；自定义 `lookup` 在实际连接时校验解析结果；拒绝绕回工作台自身端口；解压 gzip/deflate/br 并按解压后字节截断 |
| `server/sample-api.ts` | 示例规格对应的内存图书馆服务（Bearer 任意非空令牌或 `X-Librarian-Key`） |
| `server/swagger-view.ts` | 同源 iframe 页面与脚本：Swagger UI 配置、`requestInterceptor` + `userFetch` 代理、父子 postMessage（校验 origin 与 source） |
| `ui/App.tsx` | 文档状态、源码检查/应用、文件转场、试调状态 |
| `ui/Chrome.tsx`、`Directory.tsx`、`SourcePane.tsx`、`SourceEditor.tsx`、`Panels.tsx`、`files.ts` | 文件条、端点目录、源码与诊断、对话框、文件读写 |

## 关键决定

- **原文为模型**：导出原格式即原文；转换只在另存为或显式「转为 JSON/YAML」时发生（YAML 注释提示会丢失）。
- **代理不改变 Swagger 的请求表达**：拦截器只设置 `userFetch`，Swagger 显示的 Request URL 与 curl 仍为真实目标。代理以 JSON 封装状态、响应头（`set-cookie` 改名为 `x-upstream-set-cookie` 仅供显示）和 base64 响应体，iframe 重建 `Response` 交给 Swagger。代理自身的失败（阻止、DNS、连接、超时）以 200 + `error` 封装返回，与工作台服务故障区分，并在父页面显示状态卡。
- **授权只在内存**：`persistAuthorization:false`，iframe 在模式切换时保持挂载；页面不读取或保存 Swagger 授权状态。
- **虚拟列表**：Swagger UI 5.34 对大量端点虚拟渲染并监听 window 滚动，所以 iframe 文档由视口滚动（不能让 body 成为滚动容器）；目录定位先调用 `layoutActions.scrollToVirtualizedOperation`。
- **CSP**：父页面与 iframe 保持 `script-src 'self'`、`connect-src 'self'`；iframe 增加 `img-src blob:` 以显示图片响应、`form-action 'none'`。
- 自动保存使用统一 autosave 模块与 0003 迁移，本版本没有新增迁移；`storageKey` `swagger-ui-studio` 与 appId 不变。工作副本 `extra` 中的 `editorText`（错误源码草稿）与 `aiPrompt`、`__aiSuggestion` 随保存/恢复/恢复稿往返。

## 测试

`tests/openapi.test.ts`（解析、行号、结构、别名炸弹、转换）、`tests/proxy.test.ts`（地址分类、封装校验、真实本地 HTTP 服务上的阻止/转发/解压/重定向/截断/超时/自身端口/DNS）、`tests/sample-api.test.ts`（示例规格每个端点都已实现、借阅流程）、`tests/model.test.ts`（升级、SQLite 持久化与冲突）。

固定依赖同时记录在项目根和 app 的 package/lock 文件。SDK、日志、本地数据不提交。
