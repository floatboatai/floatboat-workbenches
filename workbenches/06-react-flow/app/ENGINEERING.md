# 工程说明（0.9.0）

## 契约层 `src/contracts/`（纯 TypeScript，测试与浏览器共用）

- `values.ts`：端口值（text/table/json）、CSV 解析与输出、预览/摘要、规模上限。
- `ops.ts`：20 种节点的类别、输入端口（可接受类型）、输出端口（固定、`same` 跟随输入或由配置决定）与配置字段结构；`normalizeConfig` 补默认值并校验类型/长度。
- `expressions.ts`：受限表达式——安全正则编译（嵌套量词静态拒绝、标志白名单）、`{{字段}}` 模板、JSON 路径解析器。不使用 `eval`/`new Function`。
- `transforms.ts` + `table-ops.ts`：每种操作的纯函数。
- `engine.ts`：拓扑排序、环成员检测、端口类型推断、连接检查、节点签名（FNV-1a）、`runPipeline` 与可保存的 `toRunRecord`。
- `flow.ts`：文档结构校验（节点/端口/单输入/上限）、草稿恢复（允许空名称）、0.3 单链转换、AI 生成稿剔除运行记录。
- `templates.ts`：模板库与种子。

## 界面 `src/ui/`

`Studio.tsx` 组合顶栏、`Palette`、`PipelineCanvas`（受控 React Flow：位置拖动结束才提交、尺寸与选中由界面状态保持、`isValidConnection`、`onDelete`、拖放、ResizeObserver 自适应）、`Inspector`/`ConfigEditors`（按字段结构生成表单）、`RunConsole`、`Dialogs`。`runner.ts` + `engine.worker.ts` 在 Worker 中执行并逐节点回传；新运行取消旧运行，超时终止 Worker。`useHistory.ts` 只记录节点/连线，同字段连续输入合并为一步。`graph-edit.ts`（dagre 布局、复制粘贴、连接替换）为纯函数并有单元测试。

## 服务端

只负责项目/自动保存与 AI 起草（`/api/generate`，提示词由节点目录生成，返回经 `validateGeneratedFlow` 校验）。旧版 `/api/run` 已移除：执行放在可终止的浏览器 Worker 中，避免正则回溯阻塞服务进程。`/api/app` 报告 Host 连接状态。

## 持久化

沿用原表与迁移（0001–0003），未新增迁移。`projects.payload` 存流水线文档；读取时旧 0.3 单链自动转换。`lastRun` 只在点击“运行”时写入（每节点 ≤12 行/1,200 字符预览）；自动运行结果只在内存中。工作副本 `draft` 保存 AI 提示词与候选稿。`storageKey` 仍为 `react-flow`。
