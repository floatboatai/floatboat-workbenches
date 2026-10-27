# Univer 表格工作台

用原生 Univer Sheets 编辑预算和日常数据：网格、公式栏、格式工具与工作表标签直接可用。文件条提供工作簿切换、新建、导入、导出与自动保存状态。

![Univer 表格工作台](../../docs/screenshots/univer.png)

## 使用

在仓库根目录运行：

```sh
pnpm workbench prepare univer
pnpm workbench check univer
pnpm workbench dev univer
pnpm workbench package univer
```

源代码包通过 **Floatboat → 我的 → 工作台 → 导入工作台** 安装。独立预览使用真实 HTTP 和 SQLite，本地编辑不依赖模型服务。Floatboat Desktop 实际导入尚未验证。

- 双击单元格编辑；Enter 应用，Esc 取消。公式以 `=` 开头，前置单引号输入字面文本。
- 原生工具栏支持字体、颜色、对齐、数字格式、合并单元格、撤销与重做。底部标签支持工作表切换及管理。
- 编辑、名称和导入输入自动保存。未提交的单元格文本单独保存；重新打开后选择应用或放弃，已应用单元格不会被静默覆盖。未提交富文本恢复保留文本，不保留尚未应用的局部文字样式。
- CSV 导入将公式形态的内容保留为文本，保留 `00123` 一类标识。CSV 导出当前工作表的计算结果，危险字面文本添加保护单引号；CSV 不承载公式源、格式和多张表，保护前缀可能在再次导入时保留。
- “导出工作簿”下载原生 Univer JSON，保留工作表、公式、格式和计算值。导出先结束当前单元格编辑并等待公式计算；存在重载后的恢复草稿时先应用或放弃。导入 CSV 或 JSON 都创建新工作簿。
- 离线时可恢复同一浏览器、同一来源下的 IndexedDB 草稿；这不是跨端同步。冲突时导出恢复草稿或打开服务器版本。后台保存不阻塞输入。

## 边界

工作簿上限 850 KB、8 张表、每表 2000 行 × 200 列、共 20000 个非空单元格。CSV 和 JSON 文件上限均为 850 KB。超限工作副本会明确显示未应用/待完善状态；应导出恢复草稿并减少数据。导入不支持图片、外部链接和未知插件资源。

仅使用开源 core preset；不含商业 XLSX/PDF 交换、云协作、图表或图片插件。计算支持范围以 Univer 1.2.0 的开源公式引擎为准。窄屏保留原生桌面控件并在表格区域横向滚动；真实手机软键盘与完整读屏表格操作未验证。

## 验证

- `pnpm workbench:check`：类型、依赖、清单和生产构建通过；仅共享 autosave 模块体积提示。
- `pnpm test`：9 个业务测试覆盖 CSV 引号/换行/BOM、公式与文本语义、数值导出、模型约束、未提交草稿、真实 SQLite 幂等写入、冲突及无效模型保留。
- Chrome（实际安装的 `channel: chrome`）完整脚本 16 项通过，另有原生加粗、增加工作表、编辑中导出 3 项通过。已验证原生键盘编辑、公式联动、CSV 内容、JSON 导入回环、延迟响应中继续输入、单元格草稿刷新恢复、无效导入恢复、导入新项目、提交后丢失响应的幂等重试、503 重试、跨窗口冲突、新标签页冲突保持、新建离线草稿切换找回。原生工作表切换后导出的 CSV 对应当前表。1440×1000、375×812、暗色与 reduced-motion 通过；页面无横向溢出，表格容器可横向滚动，最终浏览器检查无 pageerror。
- 数值证据：将 B2 改为 60，Univer 得到 D2=1440、计划总额=2794，实际下载 CSV 对应这些数值，JSON 同时保留 `=B2*C2` 和 `=SUM(D7:D8)`。
- 截图：1440×1000，SHA-256 `5637c6ae3ef6ff9c6171b4cc4a5c7fb1018787b0d97452ae0cf566ff734e6f37`。脚本、结果及下载文件保留在忽略目录 `.cache/`。

## 来源与许可

直接依赖 `@univerjs/presets`、`@univerjs/preset-sheets-core` 均精确固定为 **1.2.0**，全部 Univer SDK 发布包保持同一版本（图标包 icons 1.46.0 依上游独立发布），未安装 `@univerjs-pro`。React / React DOM 19.2.3，Lucide React 0.562.0。包版本与文档于 2026-10-27 核对。

- [Univer 官方源码](https://github.com/dream-num/univer) · [安装与一致版本要求](https://docs.univer.ai/guides/sheets/getting-started/installation)
- [工作簿结构](https://docs.univer.ai/guides/sheets/model/workbook-data) · [Facade 事件](https://reference.univer.ai/en-US/classes/FEventName) · [公式 API](https://reference.univer.ai/en-US/classes/FFormula)
- Univer 为 Apache-2.0；[保留完整上游许可证](app/licenses/UNIVER-APACHE-2.0.txt)。图标包为 MIT，许可证见 `app/licenses/UNIVER-ICONS-MIT.txt`。引擎代码不修改，示例预算为本项目普通演示数据。

实现细节和验收契约见 [ENGINEERING.md](app/ENGINEERING.md)、[DESIGN.md](app/DESIGN.md) 与 [REQUIREMENTS.md](app/REQUIREMENTS.md)。
