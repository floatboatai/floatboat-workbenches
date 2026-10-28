# FigCraft引擎连接

本源码包包含工作台前后端；真实渲染还需要独立FigCraft CLI服务。

服务源码与启动文档：https://github.com/floatboatai/floatboat-workbenches/tree/main/workbenches/72-figcraft/service

使用官方FigCraft CLI 0.11.2并配置FIGCRAFT_CLI，启动Node22适配服务，默认127.0.0.1:8796。工作台服务端可配置FIGCRAFT_SERVICE_URL和可选FIGCRAFT_SERVICE_TOKEN。未连接时保留已保存设计与草稿，可导出原生文件/完整项目，渲染和图像导出需连接后重试。
