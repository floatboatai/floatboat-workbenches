# 0.2.0 本地验收

2026-10-27，Node22，真实 Chrome。`pnpm workbench:check` 与 `pnpm test`（7 项）通过。

空白节点名保存为草稿并刷新恢复；修复名称后真实运行 input → uppercase → prefix → output；输出“结果：ORDER 42”刷新后仍在，JSON 配置与 TXT 结果读回。

执行器依然拒绝断链、分支与环；AI 返回的 lastRun 在服务端剔除，不能作为已执行结果。

1440px、375px、深色模式与 reduced-motion 浏览器验证通过，无意外页面异常、外部 HTTP 资源或 CSP 拒绝。Maker 故意中断一次自动保存响应属于故障注入。源码测试包括真实 SQLite、业务契约与恢复边界。

证据保留在 visual 工作树 `.cache/autosave-*-results.json`、`.cache/verify-*-auto.mjs` 和 final 截图；README 图片由批次截图任务集中入库。未把打包成功等同 Host 导入，当前版本的客户端导入验证留待总仓库发布验收。
