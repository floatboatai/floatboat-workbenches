# 工程说明

`contracts/model.ts` 定义并校验业务输入；`server/routes.ts`、`store.ts` 提供 SQLite 项目和 revision 乐观锁。`server/index.ts` 注册当前业务与真实 Host LLM。`ui/App.tsx` 管理页面，重型渲染按需加载。

CSV/JSON 数据和受限图形参数映射到 Plot API；不执行模型返回代码。

固定依赖同时记录在项目根和 app 的 package/lock 文件。源码构建使用官方固定模板，SDK 与本地数据不提交。运行、测试与打包命令见项目 README，验收范围由实际测试结果记录。

异步文件读取结束后使用最新项目状态构造并验证完整 Model；有效候选在 dirty 时必须确认后才替换，取消及无效文件均不改原数据或映射。
