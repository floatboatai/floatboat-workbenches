# 数据观察室

版本0.1.0，本地与真实Host模型生成通过；客户端导入未验收。

从总仓库执行 `pnpm workbench prepare observable-plot` 与 `pnpm workbench dev observable-plot`。

输入或导入CSV/JSON数据，选择横轴、数值列及趋势线/柱状图/散点图，生成真实Observable Plot图表。可保存打开观察项目、导出源数据与SVG，查看前100行数据表。AI候选数据需明确采用，不自动替换当前数据。

## 验证与边界

`pnpm test` 5项通过，覆盖CSV引号、重复表头、行长度、数值字段和SQLite保存冲突。Chrome实测图表、切换类型、保存刷新恢复、数据/SVG导出、非法CSV恢复、真实模型候选生成与采用；1440/375px、暗色和reduced-motion通过，页面异常、console error、失败请求均0。

输入上限500000字符、10000行、40列。采用受限参数调用Plot API，不eval字符串；CSV解析支持引号、逗号、换行和BOM，数值列必须完整有效。

`pnpm workbench package observable-plot` 生成 artifacts/observable-plot-studio-0.1.0.fbworkbench。通过Floatboat「我的→工作台→导入工作台」安装。

分类横轴遵循数据首次出现的顺序；数值横轴保留数值尺度。CSV 拒绝闭合引号后的非分隔字符。
