# 原型校样 · FigCraft

逐屏审阅 FigCraft 原型：看画板、改文案、改图层名称与填色、记交付备注、标记“可交付/已完成”，带走更新后的 `.figcraft`、交付说明和预览图。

![原型校样](../../docs/screenshots/figcraft.png)

- **无需引擎即可使用（0.9.0）**：工作台自己的 Node 服务读取 `.figcraft`（zip + `document.json`），浏览器按节点树画出近似校样（自动布局→flex，矢量网络/椭圆→SVG，填充/渐变/圆角/描边/阴影→CSS），并标注“近似校样”。示例 Calm Studio（Ridgeline Trails 4 屏 + 3 组件，224 个图层）首开即可审阅。
- **直接写回原生文件**：文案（characters）、图层/画板名称、填色、交付状态（none/readyForDev/completed，可交付后再改动自动标记“已变更”）、同页画板顺序。语义与 FigCraft CLI 0.11.2 的 `node.set` 对照一致（overrides、样式解绑、dev_changed），其它 zip 条目原样保留。
- **审阅交互**：缩略图画板带、单击画板选图层、双击文字直接改写；未应用的文案/名称/填色在画板上以虚线预览并自动保存；“应用本屏 n 条”批量写入。
- **导出**：当前画板 SVG（矢量，按实际排版量取）与 PNG 2×（近似）、交付说明 Markdown、设计文件 `.figcraft`、完整工程 JSON。原生 PNG/PDF 需引擎，菜单内附引擎状态卡（安装/启动命令、地址、重新检查）。
- **可选原生引擎**：本机 FigCraft CLI 0.11.2 适配服务在线时，增加“原生”渲染切换、原生 PNG/PDF，单项修改走引擎；渲染/修改前先 `text.refit`，让无引擎期间改过的文字框按真实字体重排。引擎中途断开时修改自动回退内置写入。
- 文件生命周期在左上“校样文件”对话框：打开 `.figcraft`、导入工程/恢复稿、示例副本、最近校样、下载、删除、工程 JSON 草稿。导入总是另建校样。
- 上限：原生文件 1.35 MB（SDK 单次请求 2 MB 内保存完整工作副本）、6 万图层、展开 80 MB。

近似校样使用系统字体代替设计字体（如 Inter），文字宽度会有几像素差异；图片填充显示为占位斜纹。这里不是完整 FigCraft 桌面编辑器，不执行原型交互或任意图层工具。

## 原生引擎（可选）

按[service/README.md](service/README.md)安装固定版本 CLI 并启动独立服务（默认 `127.0.0.1:8796`）。工作台服务用 `FIGCRAFT_SERVICE_URL` 连接，可选 `FIGCRAFT_SERVICE_TOKEN`。不需要模型账号或 GPU。

```sh
pnpm workbench prepare figcraft
pnpm workbench check figcraft
pnpm workbench test figcraft
pnpm workbench dev figcraft
pnpm workbench package figcraft
```

Floatboat → 我的 → 工作台 → 导入工作台；客户端源包导入尚未实测。详细证据见[验收](ACCEPTANCE.md)。

上游：[FigCraft](https://github.com/storytold/figcraft)，MIT 或 Apache-2.0；fflate 0.8.3（MIT）用于读写 zip。本项目保留上游 NOTICE 和许可证，未复制品牌标识。
