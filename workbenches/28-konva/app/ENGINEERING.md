# Engineering

固定模板 3b55d46f7ae25e939ce3299073c37ed334d69c02；React 19.2.3 与 Konva 10.9.0，MIT。未修改 SDK、CSP 或共享蓝图。capabilities=[]。

`contracts/board.ts` 维护画板/对象/原件契约与 import decoder。restoreBoard 保留合法结构的原 wire 值和额外字段，validateBoard 再执行正式模型范围与容量约束。非法工程不会进入 Konva，原稿仍可修复。`ui/Canvas.tsx` 使用原生 Stage、Layer、Rect、Text、Arrow、Image、Transformer；ResizeObserver 只缩放视图，PNG 恢复原像素尺寸。组件在 documentKey 变化时销毁，原图读取以 disposed guard 隔离旧画布。

`ui/App.tsx` 将坐标/文本/颜色草稿写入 autosave extra.properties，源码写入 extra.json；同步 transitionRef 与 UI transitioning 覆盖 new/open/import。原图读取与工程导出捕获 documentKey，迟到结果不会改到新文档。服务端先验证原图后再进行 SQL 事务。标准蓝图实现 IndexedDB 备用副本、幂等 mutationId、乐观 revision 和原始回执恢复。

`server/images.ts` 验证 PNG/JPEG 魔数/尺寸，SHA-256 命名，原子写入已声明的 originals。GET 只接受哈希，无路径穿越。浏览器用 data:image/png/jpeg，不用 blob 图片或远程 CDN。工程图片逐张上传以适配约 2MB HTTP 请求限制。导出不读取外部 URL。

验证：pnpm workbench:check；pnpm test；真实 Chrome 浏览器主流程/自动保存故障矩阵；pnpm package。app/licenses 为声明的固定 asset。源码包排除 originals、SQLite、IndexedDB 和浏览器测试数据。
