# 0.2.0 本地验收

2026-10-27，Node22，真实 Chrome。`pnpm workbench:check` 与 `pnpm test`（6 项）通过。

width=0 保存 draft 并刷新恢复，禁止旧几何导出；延迟响应期间由202继续改203，最终保存203；服务器已提交204而响应丢失，重试不重复创建；409 保留本地输入。

JSON 导入创建新文档且原项目未变；SVG 200mm、DXF INSUNITS4 与项目 JSON 下载读回，SVG 独立打开完整显示。

1440px、375px、深色模式与 reduced-motion 浏览器验证通过，无意外页面异常、外部 HTTP 资源或 CSP 拒绝。Maker 故意中断一次自动保存响应属于故障注入。源码测试包括真实 SQLite、业务契约与恢复边界。

证据保留在 visual 工作树 `.cache/autosave-*-results.json`、`.cache/verify-*-auto.mjs` 和 final 截图；README 图片由批次截图任务集中入库。未把打包成功等同 Host 导入，当前版本的客户端导入验证留待总仓库发布验收。
