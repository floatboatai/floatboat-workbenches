# 0.2.0 本地验收

2026-10-27，Node22，真实 Chrome。`pnpm workbench:check` 与 `pnpm test`（7 项）通过。

96bp 单 FASTA 导入新文档；94→3 反向跨原点通过实际查看器选择为 CGTAAC；原始输入 ACGT123、未登记特征名称、意见和选区均刷新恢复。

未应用序列时禁用业务导出；恢复有效输入后选区 FASTA 与项目 JSON 读回2项特征、1条意见。

1440px、375px、深色模式与 reduced-motion 浏览器验证通过，无意外页面异常、外部 HTTP 资源或 CSP 拒绝。Maker 故意中断一次自动保存响应属于故障注入。源码测试包括真实 SQLite、业务契约与恢复边界。

证据保留在 visual 工作树 `.cache/autosave-*-results.json`、`.cache/verify-*-auto.mjs` 和 final 截图；README 图片由批次截图任务集中入库。未把打包成功等同 Host 导入，当前版本的客户端导入验证留待总仓库发布验收。
