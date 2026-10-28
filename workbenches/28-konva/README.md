# Konva 标注画板

0.6.0 · local-verified · [Konva](https://github.com/konvajs/konva) 10.9.0 / MIT

原生 Konva 图形标注工作台：创建矩形、文字、箭头与 PNG/JPEG 原图，通过拖动、Transformer 或精确属性调整位置/尺寸/旋转，管理图层顺序。全幅校样画板与可收起属性工具，不是 Polotno。

所有未应用输入与工程自动保存；延迟保存继续编辑、乐观冲突、离线副本和恢复稿重导入已验证。完整 JSON 工程包含原图；恢复稿只带原件引用，跨实例请使用完整工程。原生 PNG 在点击时冻结场景，后续编辑不改变正在导出的图像。

![Konva 标注画板](../../docs/screenshots/konva.png)

运行：根目录 `pnpm workbench prepare konva`，然后本目录 `pnpm workbench:check`、`pnpm test`、`pnpm dev -- --no-watch`。`pnpm package` 生成 `artifacts/konva-studio-0.6.0.fbworkbench`。客户端路径：Floatboat → My → Workbenches → Import workbench；hostImport=unverified。

本地验收与限制见 [ACCEPTANCE.md](ACCEPTANCE.md) 与 [acceptance-evidence.json](acceptance-evidence.json)。原图每张最多 750 KB / 1600 万像素，最多 200 对象；新增时同步检查，已有超限工作稿可恢复。完整工程导入/导出统一为 16 MiB，超限会明确提示且不会省略原图。暂不包含自由画笔、滤镜、多选、历史撤销、SVG 编辑和任意 Konva JSON。
