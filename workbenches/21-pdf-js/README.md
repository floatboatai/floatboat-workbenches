# PDF.js 工作台

状态：计划中，尚未实现。

目标：PDF 阅读、逐页摘要与资料审阅工作台

上游：https://github.com/mozilla/pdf.js

适配路线：取 pdfjs-dist 的浏览器 display API，用 React 做文件列表与批注/摘要侧栏；worker、cmaps、字体等按资源接口分发。

限制：主用途是阅读渲染，扫描件 OCR 要另接；worker/字体资源与浏览器兼容需验证，不可直接依赖 publicDir。

许可：Apache-2.0
