# OpenPencil技术实现

固定模板React/Node22/SQLite。@open-pencil/core 0.16.0的FIG读写与SVG导出运行在服务端，真实SceneGraph执行图层修改。浏览器固定CSP不允许WASM，故不把CanvasKit/Yoga加载到页面，也不改变CSP。浏览器展示引擎导出的SVG数据图及可选图层覆盖框；纯React属性编辑器在草稿里保存未应用字段。Native FIG作为项目的规范数据，原始不支持的图层保留，OpenPencil解析/重新导出本身的格式限制单列。

src/contracts/design.ts：JSON边界、容量及属性草稿校验。src/server/engine.ts：纯请求级文档解析、修改和渲染，没有共享可变文档。src/server/routes.ts：项目保存与格式API。src/ui/App.tsx：任务与异步状态，旧请求不覆盖新文件。自动保存使用仓库统一模块；业务源文件在SQLite、IndexedDB中恢复，不写入源码包。

验证：真实FIG创建、读取、修改、导出再读；SVG；字段/容量/层级边界；SQLite冲突和持久化；Chrome主任务、草稿/延迟/丢回执/导入/窄屏。没有Host模型或远端生成依赖。
