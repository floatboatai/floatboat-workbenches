# 0.2.0 本地验收

2026-10-27，Node22，真实 Chrome。`pnpm workbench:check` 与 `pnpm test`（6 项）通过。

原生矩形绘制后自动保存、刷新恢复同一场景，源文件和 SVG 下载读回；375px 首次打开与从桌面缩放均切到原生移动工具栏。

原 boards 表 adapter 事务：稳定 documentId/mutationId 重试去重、旧版本冲突保留草稿且不覆盖其他窗口。

1440px、375px、深色模式与 reduced-motion 浏览器验证通过，无意外页面异常、外部 HTTP 资源或 CSP 拒绝。Maker 故意中断一次自动保存响应属于故障注入。源码测试包括真实 SQLite、业务契约与恢复边界。

证据保留在 visual 工作树 `.cache/autosave-*-results.json`、`.cache/verify-*-auto.mjs` 和 final 截图；README 图片由批次截图任务集中入库。未把打包成功等同 Host 导入，当前版本的客户端导入验证留待总仓库发布验收。
