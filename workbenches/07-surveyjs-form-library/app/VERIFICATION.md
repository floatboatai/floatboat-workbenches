# 0.2.0 本地验收

2026-10-27，Node22，真实 Chrome。`pnpm workbench:check` 与 `pnpm test`（7 项）通过。

空题目与无效 JSON 原文刷新恢复；填写“林女士”答案后自动保存，刷新不重建为默认答案；提交 503 后重试只记录一份答卷，刷新提交状态、答案 JSON 导出通过。

填答草稿绑定定义快照，保存稳定提交 ID 后再 POST；定义变化时保留旧答案并阻止提交到新定义。

1440px、375px、深色模式与 reduced-motion 浏览器验证通过，无意外页面异常、外部 HTTP 资源或 CSP 拒绝。Maker 故意中断一次自动保存响应属于故障注入。源码测试包括真实 SQLite、业务契约与恢复边界。

证据保留在 visual 工作树 `.cache/autosave-*-results.json`、`.cache/verify-*-auto.mjs` 和 final 截图；README 图片由批次截图任务集中入库。未把打包成功等同 Host 导入，当前版本的客户端导入验证留待总仓库发布验收。
