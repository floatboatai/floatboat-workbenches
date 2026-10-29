# 第三方许可与内容来源

- Docling **2.140.0**，MIT，Copyright The Docling Contributors。历史真实 HTML/Word 转换与本轮导出 JSON 的原生 schema 校验使用独立 Python 环境；不分发 Python、模型权重或虚构官方模型输出。
- Docling Serve **1.38.2**，MIT，Copyright (c) 2024 International Business Machines。客户端合同对应上游提交 `9c058dbb58f61021e3a16e37edb8a7527b2cb2d4`；本轮仅验证本机 HTTP fixture 和合同测试，未启动官方服务。
- **pdfjs-dist 6.4.299**（Mozilla PDF.js），Apache-2.0。本地 PDF 文字提取和原页渲染；随包 CMap、标准字体及其许可位于 `app/pdfjs/`，包含 Foxit 字体许可和 Liberation 字体许可。
- **parse5 7.3.0**（Ivan Nikulin 等），MIT；**marked 16.4.2**（MarkedJS / Christopher Jeffrey 等），MIT；**fflate 0.8.2**（Arjun Barrett），MIT。用于本地 HTML、Markdown、OOXML 与校对包处理。
- React / React DOM **19.2.3**，MIT；Lucide React **0.562.0**，ISC；版本由锁文件固定，无远程字体。
- `app/fixtures/examples/` 的水质报告、巡检指导书及交接记录是原创普通演示资料，结构 JSON 由本地解析器生成并以 SHA-256 核对；不是官方 Docling 推理结果。`app/fixtures/sample.html` 与 `docling-document.json` 保留早期真实 Docling HTML 转换兼容性样例。

应用自有许可沿用 `app/LICENSE`，本次未更改授权。商标和导入文档权利仍归原权利人。源码包不含预览数据库、上传用户文件、凭据或模型权重。
