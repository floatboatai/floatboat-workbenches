# FigCraft 原生引擎（可选）

工作台不依赖引擎即可完成校样：打开 `.figcraft`、近似渲染、修改文案/名称/填色/交付状态/画板顺序，导出 `.figcraft`、交付说明与 SVG/PNG 近似图。

原生渲染与原生 PNG/PDF 需要独立 FigCraft CLI 服务：

服务源码与启动文档：https://github.com/floatboatai/floatboat-workbenches/tree/main/workbenches/72-figcraft/service

1. 下载官方 FigCraft CLI 0.11.2 并按 SHA256SUMS 核对。
2. 在 `service/` 执行 `pnpm install --frozen-lockfile --ignore-scripts`。
3. `FIGCRAFT_CLI=/绝对路径/figcraft-cli pnpm start`，默认监听 `127.0.0.1:8796`。
4. 非默认地址时为工作台服务端设置 `FIGCRAFT_SERVICE_URL`（远程须 HTTPS）与可选 `FIGCRAFT_SERVICE_TOKEN`。

界面右上“内置校样/原生引擎”胶囊与导出菜单中的引擎卡可随时重新检查。
