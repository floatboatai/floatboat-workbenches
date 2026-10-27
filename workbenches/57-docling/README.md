# Docling 文档校对台

版本 **0.4.0**。按文档结构核对抽取结果：目录、校样纸张与逐格表格编辑并列显示。原始解析文档与人工校订分开保存，可对照源文本、调整同级阅读顺序、记录备注和复核状态，再导出 Markdown、DoclingDocument JSON、表格 CSV 或完整校对项目。

## 使用

在总仓库执行 `pnpm workbench prepare docling`，进入本目录运行：

```sh
pnpm dev
pnpm workbench:check
pnpm test
pnpm package
```

打开预览打印的完整地址。内置“现场试验记录”为原创 HTML 经 **Docling 2.140.0** 实际转换所得，已明确标记示例。可导入自己的 DoclingDocument 1.x JSON，也可重新导入 `.review.json` 校对项目。导入始终新建项目。

选择结构项后修改文字、类型或表格单元格，输入自动保存。表格保留行列合并范围；阅读顺序限同级上下移动，以保留父子关系。校订 JSON 保留原有引用、原文 `orig` 与未修改字段；它是解析后重新序列化的 JSON，不是原文件的逐字节副本（JavaScript 数值精度也适用）。Markdown 是工作台的文本/表格投影，排除 furniture 层；复杂公式、图像、键值表单等字段仍保留在 JSON 中，但不作富媒体呈现。

未完成的 JSON/HTML 输入也进入完整工作副本；无效导入输入显示“草稿未应用”。背景保存不锁编辑。保存失败可重试；冲突时先导出工作副本，再读取服务器版本。恢复用工作副本也可通过“导入 JSON”创建新项目。

## 官方 Docling Serve 连接

此工作台是 **官方 API 的客户端**，没有自称 Docling 的手写转换器或仿冒服务。连接器依据 Docling Serve **1.38.2**、提交 `9c058dbb58f61021e3a16e37edb8a7527b2cb2d4` 的 [异步文件测试](https://github.com/docling-project/docling-serve/blob/9c058dbb58f61021e3a16e37edb8a7527b2cb2d4/tests/test_1-file-async.py) 和 [API 实现](https://github.com/docling-project/docling-serve/blob/9c058dbb58f61021e3a16e37edb8a7527b2cb2d4/docling_serve/app.py)。

在独立 Python 3.12 环境中安装并启动官方服务（完整依赖可能占用较多磁盘）：

```sh
uv venv .local/docling-serve --python 3.12
uv pip install --python .local/docling-serve/bin/python 'docling-serve==1.38.2'
.local/docling-serve/bin/docling-serve run --host 127.0.0.1 --port 5001
```

在另一个终端为工作台设置服务地址并启动：

```sh
DOCLING_SERVE_URL=http://127.0.0.1:5001 pnpm dev
```

如服务启用认证，使用服务端环境变量 `DOCLING_SERVE_API_KEY`。不要在页面、项目文件或提交的代码里填写密钥。源代码包不携带环境配置；导入客户端后的服务配置需在实际运行环境中设置，客户端安装未验收。

当前上传限 **HTML 文件，400 KB**。请求使用 multipart `files`、`to_formats=json`、`image_export_mode=placeholder`、`do_ocr=false`、`target_type=inbody`，流程为：

1. 先保存本地操作 ID、源文件快照和 SHA-256。
2. `POST /v1/convert/file/async`；持久化返回的上游 `task_id`。
3. `GET /v1/status/poll/{task_id}`；完成后读取 `GET /v1/result/{task_id}` 的 `document.json_content`。
4. 结果保存到数据资源，用户决定是否作为**新项目**打开，期间的人工校订不会被覆盖。

请求超时为 20 秒，结果流限 1 MB，重定向拒绝，浏览器只调用自己的同源 API。刷新只恢复已有任务，不会重交。提交响应丢失或服务在提交期间重启时保留“不确定”状态；从服务日志找到任务 ID 后可关联已有任务。暂停跟踪只停止本地轮询，**不会取消上游转换**。界面展示最近 50 条记录。

## 范围与验证

- 原生 JSON 最大 600 KB，校订项目最大 800 KB，每个数组最多 2000 项、结构深度最多 64 层，表格最多 10000 格。嵌入图片可能超过限额，建议以 placeholder 导出。
- HTML 源文件、转换结果保存在声明的 `documents` 数据资源，以安全操作 ID 命名。JSON 项目导出包含原始解析文档、校订和顺序；不包含上游运行状态、HTML 源文件或凭据。
- 当前不预览 PDF 页面、不上传 PDF/DOCX、不运行 OCR 或视觉模型，不渲染远端图片，也不把普通 LLM 输出称作 Docling 结果。
- **真实 Docling core 已运行**：原创 HTML → 5 个文本项 + 1 张表；浏览器导出的校订 JSON 被原生 `DoclingDocument` 接收，原生 Markdown 导出包含校订值。
- **官方 Serve 端到端未验收**：连接器有真实路由和 multipart/轮询/恢复合同测试；未启动完整服务实例。默认未配置状态经过浏览器验证。
- 20 项自动化测试、13 条 Chrome 交互验收通过；详见 [app/ACCEPTANCE.md](app/ACCEPTANCE.md)。Host 连接实际报告 `HOST_NOT_CONNECTED`；本地校对不依赖 Host 模型能力。

如需复现轻量真实 core 检查：

```sh
uv venv .local/docling-core --python 3.12
uv pip install --python .local/docling-core/bin/python 'docling-slim[format-html]==2.140.0'
.local/docling-core/bin/python app/tools/verify_docling.py
# 可选：加入 --corrected /path/to/export.docling.json，检查本例校订数量 14
```

包输出为 `artifacts/docling-studio-0.4.0.fbworkbench`，通过 **Floatboat → My → Workbenches → Import workbench** 导入。默认源包不含预览数据库和源文件数据。上游许可与来源见 [NOTICE.md](NOTICE.md)。
