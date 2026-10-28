# 页间 · PageIndex

PDF章节导航、原页阅读、摘录与报告审阅。真实PageIndex Flash建立章节树，PDFium提取原文并渲染页面；模型回答保留逐字核对的页码引用。

![页间工作台](../../docs/screenshots/pageindex.png)

## 使用

从总仓库运行 `pnpm workbench prepare pageindex`，然后启动本项目的独立解析服务：

```sh
cd workbenches/64-pageindex/service
uv venv --python 3.12 .venv
uv pip sync --python .venv/bin/python requirements.lock
.venv/bin/python server.py --port 8784
```

再从总仓库运行 `pnpm workbench dev pageindex`。默认服务为 `http://127.0.0.1:8784`；可用 `PAGEINDEX_SERVICE_URL` 指定本机HTTP或远程HTTPS服务，地址不进入项目文件。远程服务的部署鉴权由部署者配置；内置服务仅监听回环地址。

打开PDF或示例手册，选择章节、翻页，点击“摘录本页”填写意见。输入和未应用JSON均自动保存。问答需已连接的Floatboat Host，默认显式请求 `gemini-3.8-flash`；模型先选真实章节，再读取这些页并核对引用。模型步骤是工作台适配，未使用PageIndex Cloud检索API。

完整项目导出包含原PDF、便笺、问题、已完成回答、工作稿与运行账本；导入创建新项目，历史回答标为导入记录，未确认模型请求不会被重放。也可单独导出原生PageIndex章节JSON、原PDF和审阅Markdown。原始PDF在当前工作台数据目录，源码包不携带预览数据。

## 边界

- PDF最多8MiB、40页、30万原文字符、250个章节节点；扫描PDF无可读文字时明确失败，不包含OCR。
- 原生章节索引使用PageIndex 0.2.10的无模型Flash模式，不把确定性索引当模型推理。
- 一次模型问答最多取4个章节、12页、45000原文字符，引用必须能在原页逐字找到；超限或引用不匹配保留失败记录，不编造回答。
- 每项目最多60条便笺、15次提问。未确认提交保留操作编号，重启后未完成模型步骤标记中断，不自动重复调用。
- 图像依赖解析服务；服务断开仍可阅读已存原文、章节与便笺。IndexedDB恢复限定相同浏览器来源。

## 验证和交付

本目录运行 `pnpm workbench:check`、`pnpm test`、`pnpm package`；Python服务测试为 `cd service && .venv/bin/python -m unittest test_service.py`。实际证据见 [ACCEPTANCE.md](ACCEPTANCE.md)。

导入：Floatboat → 我的 → 工作台 → 导入工作台，选择`.fbworkbench`。解析服务/Python环境单独启动；客户端导入本次未实测。

上游：[VectifyAI/PageIndex](https://github.com/VectifyAI/PageIndex)（MIT；许可随包保留），[PDFium Python](https://github.com/pypdfium2-team/pypdfium2)。示例操作手册为本项目自制普通资料。
