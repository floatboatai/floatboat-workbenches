# pdfme 工作台

状态：计划中，尚未实现。

目标：报价单、证书、标签与合同模板批量生成工作台

上游：https://github.com/pdfme/pdfme

适配路线：DOM 容器挂载独立 UI bundle，模板 JSON 存 SQLite；表格数据映射输入并批量生成 PDF。

限制：模板填充不等于任意 PDF 原文编辑；UI 自带 React，当前源码内部版本高于模板，需验证独立 bundle 与锁版。

许可：MIT
