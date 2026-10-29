# Docling 文档校对台

版本 **0.9.0**。将 PDF、Word、HTML、Markdown 转成可校订的 DoclingDocument，核对原页或原文、修改文本和表格、标记复核，再导出真实文件。默认本地解析无需 Python、外部服务或 Host 模型。

## 开始使用

在总仓库执行 `pnpm workbench prepare docling`，进入本目录，用 Node 22.16+（22.x）运行：

```sh
pnpm workbench:check
pnpm test
FLOATBOAT_HOST_MODE=offline DOCLING_SERVE_URL=off pnpm dev
pnpm package
```

打开预览打印的完整地址。首屏提供原创 **5 页水质报告**，含跨页表格、合并单元格与图表；转换面板还提供设备巡检 Word 与交接记录 Markdown 示例。选择“转换文档”上传自己的文件，结果自动作为新文档打开。文件管理、恢复副本和最近的校对位于“文档”菜单。

| 输入 | 本地解析与对照 |
| --- | --- |
| PDF | pdf.js 读取文字层与版面，提取标题、段落、列表、表格、图像位置与页眉页脚；原页画布叠加可点选的结构框 |
| Word（DOCX / DOCM / DOTX） | 读取 OOXML 样式、编号、表格行列合并、题注和页眉页脚；按原文段落及表格对照，不执行宏 |
| HTML | parse5 提取标题、正文、列表、合并表格与图注；按源行号定位，不加载原文脚本或远端资源 |
| Markdown / TXT | marked 提取标题、嵌套列表、GFM 表格与代码块；按源行号定位 |
| DoclingDocument JSON / 校对包 | 导入已解析结构；JSON 无关联原文件时明确显示无法原页对照 |

结构目录、PDF 框或原文片段、校样文稿和校订栏联动。可以修改文本、类型、标题级别、表格单元格、同级阅读顺序、复核状态与备注。原件与校订分开保存。375px 用“结构 / 原页（原文）/ 文稿 / 校订”分页，必要操作仍可到达。

## 导出和自动保存

导出菜单提供 DoclingDocument JSON、Markdown、独立 HTML、当前表格 CSV、全部表格 CSV，以及包含原文件、原始结构和校订的 `.docling-review.zip`。校对包再次导入会新建文档。CSV 对公式前缀和引号转义；HTML 保留合并单元格；Markdown 为文本与表格投影，不承诺还原原页版式。

输入自动保存，保存期间可继续编辑。未应用的 JSON、转换方式及服务选项随工作副本恢复。失败会显示离线/草稿状态并可重试；冲突时先导出恢复副本，再读取服务器版本。恢复 JSON 只携带工作副本与内容引用，跨安装搬运请使用含原文件的校对包。

## Docling Serve（可选）

复杂扫描件、OCR 和官方模型解析需要独立官方服务；本地解析不会冒充 Docling 模型结果。转换方式旁显示服务状态、启动说明、重新检查入口和选项。默认探测 `http://127.0.0.1:5001`；设置 `DOCLING_SERVE_URL=off` 可完全关闭探测。

```sh
uv venv .local/docling-serve --python 3.12
uv pip install --python .local/docling-serve/bin/python 'docling-serve==1.38.2'
.local/docling-serve/bin/docling-serve run --host 127.0.0.1 --port 5001
# 另一个终端
DOCLING_SERVE_URL=http://127.0.0.1:5001 pnpm dev
```

认证密钥只通过服务端 `DOCLING_SERVE_API_KEY` 提供。首次启动官方服务可能下载模型。支持列表见 `app/src/contracts/jobs.ts`，包括 PDF、Word、PowerPoint、Excel、HTML、Markdown、图片等；可选 OCR、语言、PDF 后端、页码范围、表格模式和增强选项。异步提交前保存操作 ID、原文件及 SHA-256，再跟踪上游 task ID。无法确认提交时不会自动重交；暂停仅停止本地跟踪。结果需显式作为新文档打开，不覆盖人工校订。

## 容量与边界

- 原文件上限 64 MiB，结构 JSON 48 MiB；每类结构数组最多 50,000 项、每表最多 100,000 个单元格、深度 64。原文件与结构按 SHA-256 独立保存，自动保存仅同步引用和校订。
- 校订正式模型上限 800 KB，恢复工作稿 1.2 MB，完整工作副本 1.85 MB（此处为十进制字节限额）。超量输入保留修改前内容；这些是保护上限，不是最大尺寸性能保证。
- PDF 本地解析为启发式文字层解析，不做 OCR；扫描、旋转文字、复杂多栏、无框表格不保证准确。Word/HTML/Markdown 使用原文片段对照，不伪造页面坐标。图片和公式不作富媒体重建；表格不编辑行列拓扑。
- 本轮 **35 项自动化测试**与独立无头 Chrome 回归通过。官方 Serve 仅使用本机 fixture 验证协议，**真实 Serve / OCR / Host / LLM / 客户端导入未测**。最新证据与历史记录边界见 [app/ACCEPTANCE.md](app/ACCEPTANCE.md)。

包输出为 `artifacts/docling-studio-0.9.0.fbworkbench`，可经 **Floatboat → My → Workbenches → Import workbench** 导入。默认源包不携带预览数据库、上传文件或环境凭据。许可及来源见 [NOTICE.md](NOTICE.md)。
