# 工程说明

`contracts/model.ts` 定义并校验业务输入；`server/routes.ts`、`store.ts` 提供 SQLite 项目和 revision 乐观锁。`server/index.ts` 注册当前业务与真实 Host LLM。`ui/App.tsx` 管理页面，重型渲染按需加载。

source 为 Mermaid 字符串，40,000 字符上限；严格模式渲染；源文件与 SVG 分开导出。

固定依赖同时记录在项目根和 app 的 package/lock 文件。源码构建使用官方固定模板，SDK 与本地数据不提交。运行、测试与打包命令见项目 README，验收范围由实际测试结果记录。
