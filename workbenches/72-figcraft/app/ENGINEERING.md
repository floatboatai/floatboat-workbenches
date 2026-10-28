# FigCraft引擎集成

app只使用Node/React/SQLite，service是独立Node22 HTTP适配器，通过execFile调用官方FigCraft CLI 0.11.2。每次请求新建临时目录，限制CLI读写root，禁止任意命令/路径；白名单动作包括文案、图层名称、填色与交付状态。命令全批原子执行，结果仍是原生.figcraft文件；CPU导出单画板PNG。没有浏览器WASM与远程iframe。

规范数据是完整原生zip base64及逐画板笔记；未应用文字存自动保存draft。SQLite与IndexedDB使用共享机制。运行结果先校验来源documentKey/file，再采用；操作输入变更不被异步响应清除。外部服务地址和可选认证取服务器环境变量，不进项目文件。服务锁fflate 0.8.3，CLI外置不随源码包分发。

真实CLI生成示例与画板渲染、文字修改、格式导出和浏览器保存恢复分别记录，客户端导入另列未验证。
