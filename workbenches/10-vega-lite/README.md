# 图表规格实验台

版本0.1.0，本地和真实Host模型生成已验证；客户端导入未验收。

运行：从总仓库执行 `pnpm workbench prepare vega-lite`、`pnpm workbench dev vega-lite`。

编辑Vega-Lite JSON后点击「应用并绘图」，修改先经过业务校验。可保存实验、重新打开、重命名、删除；导出规格JSON和实际SVG。AI返回候选规格，确认后采用。

## 已验证

`pnpm test` 4项通过；真实Chrome运行Vega而非占位图，保存刷新恢复、JSON/SVG导出、错误JSON恢复、真实模型生成和采用通过。1440px/375px、暗色/reduced-motion无溢出，pageerror、console error、失败资源请求均0。

使用 `vega.parse(spec, undefined, {ast:true})` 与 `expressionInterpreter`，无需 unsafe-eval；图形、数据表和导出均来自内嵌data.values。仅支持基础单视图，1–10000行、500000字符；外部数据URL、图片、href拒绝。

`pnpm workbench package vega-lite` 生成 artifacts/vega-lite-studio-0.1.0.fbworkbench，使用Floatboat「我的→工作台→导入工作台」。

未应用 JSON 草稿也有离开保护；新建、切换、删除或采用候选前取消可保留原文，关闭页面触发浏览器提示。草稿未应用时禁止导出旧规格。
