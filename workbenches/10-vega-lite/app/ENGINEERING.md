# 工程说明

## 模块

| 位置 | 职责 |
| --- | --- |
| `contracts/model.ts` | 模型 `{spec, datasets}`、结构校验（视图键、700 KB、深度、原型属性）、首开示例、AI 指令 |
| `contracts/datasets.ts` | 数据集引用、CSV/TSV（RFC 4180）与 JSON 解析、类型推断、命名与上限 |
| `contracts/spec-schema.ts` | 官方 schema 规范化（安全定义名）与 @cfworker/json-schema 校验；按 anyOf 分支深度/问题数选出最相关的错误，合并同一位置的可选值，按所在定义给出拼写建议 |
| `contracts/json-source.ts` / `spec-analysis.ts` | 带位置的 JSON 解析；把语法、结构、schema、外部资源、未知数据集问题映射到行列 |
| `contracts/render-spec.ts` | 渲染前注入数据集、把同名 url 改写为数据集名、为单视图补容器尺寸、列出被阻止的外部资源 |
| `contracts/spec-edit.ts` | 字段芯片插入编码、切换数据来源 |
| `contracts/gallery.ts` / `samples.ts` | 13 个示例与确定性生成的演示数据 |
| `contracts/bundle.ts` | 项目包格式与导入识别 |
| `server/datasets.ts` | 数据集表、示例预置、UTF-8/GB18030 解码、格式嗅探、按内容哈希去重、1 MiB 分块上传 |
| `server/schema.ts` | 读取 `vega-lite/vega-lite-schema.json`，提供 `/api/schema` 与保存前完整校验（schema + 数据集存在） |
| `server/routes.ts` | 图表、数据集、schema、AI 路由 |
| `ui/App.tsx` / `actions.ts` | 布局、分析与自动应用；文件生命周期动作 |
| `ui/Chart.tsx` / `engine.ts` | 渲染（AST interpreter、阻断加载器、日志收集）、SVG/PNG 导出 |
| `ui/Inspector.tsx` / `SpecEditor.tsx` / `schema-assist.ts` | 规格检查器、CodeMirror、schema 补全与悬停 |
| `ui/DataWindow.tsx` / `data-client.ts` | 数据窗、上传与读取缓存 |

## 数据与迁移

追加 `0004_datasets.sql`（`datasets` 表：id、format、bytes、rows、columns、content、created_at），未修改 0001–0003。数据集 id 为 `sha256(format + "\0" + 原文)`，示例为固定 `sample-*` id，服务启动时幂等写入。项目 payload 只含引用；0.3.0 的 `{spec}` 模型读取时 `datasets` 默认为空数组。被移除或不再引用的数据集原文保留在表中（不做回收）。

## 校验分层

- 结构校验（同步、两端共用）用于模型解码与恢复。
- 官方 schema 校验在页面（编辑时，决定是否自动应用）与服务端（自动保存 `verify`、项目 POST/PUT、AI 结果）都执行；数据集存在性只在服务端检查。不通过时自动保存记为草稿，模型保持上一次有效版本。
- 页面 CSP 不允许 eval，因此选用解释型校验器，不用 Ajv。

## 渲染

`compile` → `parse(..., {ast: true})` → `View({expr: expressionInterpreter, loader: 阻断加载器, logger: 收集器})`。新视图在离屏容器完成后替换旧视图；失败时保留旧图。只有需要填满容器的单视图/图层随尺寸变化重绘，尺寸以图表区整体（减工具条）为准，提示条出现与否不触发重绘。

## 0.2.0 自动保存与恢复

使用主仓库统一 autosave 模块与 0003 迁移。工作副本包括 title、data 与 extra（`jsonText` 规格原文、`dataTab`、`dataCollapsed`、`exportScale`、`aiPrompt`、`aiPanel`、`__aiSuggestion`）。700ms 防抖、串行提交、documentId/mutationId 去重和 revision 冲突保护；后台同步不锁定编辑器。

运行、测试与打包命令见项目 README。
