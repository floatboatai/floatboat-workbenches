# Invoice Builder 集成

固定上游2979d91742008be0d2376e919be9e404657a900b。src/vendor/money.js与pdf.js由官方源码经esbuild转译，金额/版式逻辑不重写；唯一适配是去除PDFDocument内32个字体导入与自动注册，改用manifest资源中的随包Noto Sans SC。原始源码、SHA-256、MIT与修改说明在notices/。

contracts/document.ts负责完整字符串工作稿、形式验证、格式上限和导入。contracts/native.ts把通过校验的单据转换为上游InvoiceFromData及原生布局。server/pdf.ts负责一次性字体注册和真实React PDF生成；POST /api/pdf不保存或发送单据。SQLite项目与autosave模块保存完整副本。图片直接作为受限PNG/JPEG原件存入文档，工程导出含原图。

UI使用编辑页+纸张预览；PDF.js只展示本应用生成的PDF，关闭WASM并遵守固定CSP，不接受任意外部PDF。请求有documentKey和generation守卫，导出固定点击快照。资源路径通过app.resources.path解析，禁止使用原机器绝对路径。

验证：pnpm workbench:check、pnpm test、实际Chrome、真实PDF渲染/回读与pnpm package。无外部网络副作用，不使用Host模型。
