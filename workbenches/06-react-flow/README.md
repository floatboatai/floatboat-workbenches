# 流程实验室（React Flow）

已实现并完成本地验收，使用 @xyflow/react 12.12.0。上游：https://github.com/xyflow/xyflow。

## 功能

编辑节点与连接、参数检查器、键盘可操作的步骤选择与连接表单。当前执行器支持输入文本、转大写、添加前缀、输出四类操作，运行真实单链变换并保存每步输入/输出和配置签名。配置变化时旧结果标记为需要重新运行。可以导出配置 JSON 和上次结果文本。

AI 生成的是待检查的配置，先预览再采用；采用不自动运行。执行不是模拟动画，也不会调用任意外部服务。

## 运行

总仓库：`pnpm workbench prepare react-flow` → `pnpm workbench dev react-flow`。测试：`pnpm workbench test react-flow`。打包：`pnpm workbench package react-flow`，在 Floatboat「我的 → 工作台 → 导入工作台」使用源包。

## 初版验证记录（0.1.0）

- 类型/构建和 6 项测试通过，涵盖真实执行、无效拓扑、配置签名、持久化与版本冲突。
- Chrome 1440px 与 375px：编辑参数、实际运行、保存刷新恢复、JSON 导出、非法分支拒绝通过。
- 测试输入 hello 宇宙，实际输出「通知：HELLO 宇宙」，4 个步骤输入输出与预期一致。
- 真实 Floatboat LLM 生成配置成功（200），建议先预览。
- 页面异常 0，失败请求 0，窄屏横向溢出 0；reduced-motion 已检查。
- 源包导出通过，Host 客户端导入尚未验收。

## 范围

仅支持单链，最多 30 个步骤、60 条连接，结果最多 20,000 字符。分支、断链、回路、缺失或多个输入输出会被拒绝。它不是任意代码执行器，也不替代 Floatboat 的通用 Workflow。

上游 React Flow 为 MIT，版权文本见 `app/src/notices/react-flow.LICENSE`。本仓库未为所有新增应用统一选定许可证。

## 0.2.0 自动保存与产品布局

暗色节点 IDE、右侧参数和底部执行控制台。编辑后 700ms 防抖自动保存，提交串行且不锁定输入；IndexedDB 暂存、SQLite 工作草稿与合法项目分别保存。无效输入仍保留为草稿，网络失败和版本冲突明确提示并可导出恢复文件。导入创建新项目，打开/新建先同步旧草稿，只有需要放弃未同步内容时才确认。本项目保留节点、连接、真实运行结果和 AI 草稿。

本轮 `pnpm workbench:check`、`pnpm test`（7 项）通过；真实 Chrome 验证自动保存、刷新恢复、业务导出、375px、深色模式和 CSP 资源。桌面截图见 README 图片。最终 0.2.0 包由总仓库统一打包；Host 导入仍需在客户端验证。
