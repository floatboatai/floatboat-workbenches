# Graphify集成

contracts/graph.ts严格验证原生node-link图谱与编辑项目，原生JSON额外字段原样保留。路径为按directed标记执行的BFS；并行边不合并。
server/routes.ts提供共享SQLite项目与自动保存接口。server/extraction.ts只转发有限源码到配置的loopback/HTTPS服务，超时、响应字节和inputHash均检查。Python服务为每个请求启动有25秒超时的新解释器，避免上游模块缓存跨项目；临时目录隔离输入，完成后清理；不执行代码、不调用外部模型。
ui/App.tsx为知识地图，GraphCanvas使用可访问的HTML节点按钮＋SVG边；人工坐标、笔记与上游graph分开，避免破坏原始格式。新请求结果保存在工作稿，显式采用才替换图谱。文档epoch隔离旧响应。
共享autosave-client/cache/server保持仓库实现。运行pnpm workbench:check、pnpm test、pnpm package；Python测试用真实安装引擎。Graphify Apache-2.0/历史MIT许可通过app/notices声明资源打包。
