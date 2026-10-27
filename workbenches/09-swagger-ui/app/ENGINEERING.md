# 工程说明

业务输入由 contracts/model.ts 校验。server/routes.ts 与 store.ts 提供 SQLite 项目和 revision 乐观锁；server/index.ts 注册同源只读示例接口及真实 Host LLM。LLM 候选先校验，用户明确采用后才更改当前规格。

固定 swagger-ui-dist 5.34.0，由服务端只读路由提供官方 JS/CSS。Swagger 在同源独立 iframe 中运行，上层 React 19 管理项目与编辑器，避免旧 React 组件和 Node buffer 浏览器兼容问题。父子 postMessage 同时校验 origin 与 source；ready 握手发送首次规格，更新调用 specActions.updateSpec；父监听在卸载清理，子 ResizeObserver 和监听在 pagehide 清理。

父页面和 iframe 均维持模板 CSP：script-src self、connect-src self，不加入 unsafe-eval。关闭在线 validator、URL query 配置和持久化凭据。只接受内部 $ref 与相对同源 servers，试调按钮和 requestInterceptor 双重限制同源 GET；没有任意 URL 代理。示例 GET /api/demo/health 不写数据。

JSON 编辑稿独立于已应用规格。未应用修改阻止保存和导出旧规格；离开页面、打开、新建、删除和覆盖候选前保护草稿，取消保留原文。无效输入不覆盖可用文档。

固定依赖同时记录在项目根和 app 的 package/lock 文件。使用官方固定 Vite/Node 模板，SDK、日志、本地数据不提交。未进行 Floatboat 客户端导入验收。

## 0.2.0 自动保存与恢复

使用主仓库统一autosave-contracts/server/client/cache/requests/workspace模块，追加0003_autosave迁移，不修改既有迁移。工作副本包括title、data及extra草稿；700ms防抖、串行提交、documentId/mutationId去重和revision冲突保护。只有合法业务模型写入projects；未完成输入保留在工作草稿。后台同步不锁定编辑器，自动保存状态与渲染/应用状态分别呈现。独立编辑器以documentKey/loadEpoch识别文档切换，禁止根据自动创建的current.id重置输入。
