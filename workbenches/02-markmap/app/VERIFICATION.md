# 0.2.0 本地验收

2026-10-27，Node22，真实 Chrome。`pnpm workbench:check` 与 `pnpm test`（4 项）通过。

Markdown 自动保存；501 行无效业务草稿刷新后原样保留并维持 draft；AI 描述恢复；折叠大纲后脑图适应空间；SVG 独立打开尺寸与内容正确。

未重新调用 LLM；既有生成路径保留，生成稿保存于 draft 并需明确采用。

1440px、375px、深色模式与 reduced-motion 浏览器验证通过，无意外页面异常、外部 HTTP 资源或 CSP 拒绝。Maker 故意中断一次自动保存响应属于故障注入。源码测试包括真实 SQLite、业务契约与恢复边界。

证据保留在 visual 工作树 `.cache/autosave-*-results.json`、`.cache/verify-*-auto.mjs` 和 final 截图；README 图片由批次截图任务集中入库。未把打包成功等同 Host 导入，当前版本的客户端导入验证留待总仓库发布验收。
