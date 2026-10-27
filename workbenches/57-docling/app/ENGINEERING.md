# 工程约定

稳定身份：`workbench.eace0c23-7f0d-4c80-888b-6a1f0cccb38e` / `docling-studio@0.4.0`。Node 22、React 19，生产依赖未新增，固定模板/CSP 未修改，manifest 不声明模型能力。

## 模块

- `contracts/document.ts`：Docling 1.x 导入边界（大小、引用、环、深度、单元格坐标）、原始解析对象、独立校订层、同级顺序、JSON/Markdown/CSV 导出。
- `contracts/example.ts` 与 `fixtures/`：原创 HTML 通过 Docling core 得到的已标记示例；保留真实层级、表格和家具层。
- `ui/App.tsx`：结构树/纸面/校订面板、文件菜单和转换操作，不在浏览器存储密钥。读取状态与临时 UI 选择由 React 管理，实际业务数据和原始编辑稿走 `useProjects`。
- `server/docling.ts`：官方 Serve 连接器，固定服务端 origin、无重定向、20 秒超时、限额 JSON 流，独立操作与结果资源。`createJobs` 可注入传输用于明确标记的合同测试。
- `server/store.ts`、`server/autosave.ts` 与 UI autosave 模块：沿用共享 SQLite + IndexedDB 完整工作副本实现；变更业务未修改保存机制。
- `0004_docling_operations.sql`：追加独立操作表，不修改已存在的迁移。

## 持久化和边界

`Review` 持有 original、按 self_ref 的 corrections、order、来源说明。校订仅覆盖需要更改的 text/label/table_cells，orig、引用、未知字段保留；导出同时更新 Docling table grid。JSON 原始数值经过 JavaScript Number 解析，因此不承诺原 JSON 字节或超安全整数的逐字精度。复杂图像/公式/表单保留 JSON，当前 Markdown 只投影文本和表格。

项目上限 800 KB；raw JSON、HTML、文件名和待关联 task ID 放入额外草稿，服务端工作副本与本机 IndexedDB 一起保留。模型未变但输入草稿存在时界面明确“草稿未应用”。恢复工作副本导入会创建新项目。

源 HTML 写入 `documents/{operationId}.input.html` 后提交，SQLite 保存本地 ID、输入 SHA-256、服务 origin hash、上游 task ID、状态与时间。`submitting` 在进程重启时转为 uncertain；重复 ID 只读已有记录，不触发网络提交。提交未知必须手动关联已知任务。结果原子写入 `documents/{operationId}.result.json`，采用时新建项目，不覆盖运行期间的编辑。上游没有接入取消接口，暂停只关闭本地跟踪。现有任务的服务 origin 不匹配时拒绝查询。结果路径以安全 ID 派生，未暴露原始路径/密钥；API 不提供任意 URL 代理。

固定选项为 JSON、placeholder、关闭 OCR、inbody；HTML 源文件最大 400 KB。官方独立服务端配置使用 DOCLING_SERVE_URL / DOCLING_SERVE_API_KEY，UI 仅 same-origin SDK page.fetch。源码包不含数据目录或环境变量。

## 验证

`pnpm workbench:check` → `pnpm test` → Chrome 交互验收 → 真实 Python Docling core → `pnpm package`。20 个自动化测试中 8 个服务测试明确命名 contract，不宣称真实服务执行。真实 core 输出和校订 JSON 经原生 DoclingDocument 验证；完整 Serve/PDF/OCR/Host 安装未验收。详细结果见 ACCEPTANCE.md。
