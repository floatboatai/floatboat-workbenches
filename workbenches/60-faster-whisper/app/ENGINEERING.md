# 字幕剪辑室工程记录

## 执行边界

固定 Node22 / React19 / SQLite 模板；应用无新增 runtime npm 依赖，没有修改 CSP 或 SDK。`src/server/index.ts` 注册业务路由；浏览器使用 SDK page connection 同源访问。manifest capabilities 为空，因为本应用不调用 Host ASR/LLM。

Python 推理在仓库同项目的 `service/` 独立运行，默认地址 http://127.0.0.1:8768。应用包只携带 Node/React 业务源码，不包含 Python 或模型。安装说明见仓库 `workbenches/60-faster-whisper/README.md`，源码链接：https://github.com/floatboatai/floatboat-workbenches/tree/main/workbenches/60-faster-whisper/service 。

## 模块

- `contracts/transcript.ts`：音频 metadata、字幕行/草稿类型、时间校验、SRT/VTT/上游 JSON 导入和导出、拆分。
- `contracts/job.ts`：任务标识、输入、远端结果和页面任务响应校验。
- `server/files.ts`：有界分块、SHA-256、容器签名、临时文件原子重命名、资源存在性验证。
- `server/jobs.ts`：先持久化再调用服务，固定任务 ID、并发去重、输入一致性验证、结果身份校验、状态未知后的对账；远端 URL 只从服务端环境读取，禁止重定向。
- `server/routes.ts`：项目/自动保存、音频与任务 HTTP 路由。
- `ui/App.tsx`：音频监看、可编辑字幕、审校与任务结果采纳。播放时间不写项目；字幕行 memo 并使用稳定事件引用。
- `ui/media.ts`：受限音频上传、下载与便携项目中的字节转换。
- `ui/autosave-*`、`workspace.tsx` 等：原样沿用仓库当前自动保存协议。

## 数据与状态

项目模型含音频 SHA-256 引用、字幕行、语言、备注和来源。字幕时间保留为字符串；保存模型校验要求合法时间，完整工作稿允许暂未完成的时间。待导入字幕等额外输入通过保存协议的 `extra` 保存。导入和采用新结果始终调用 `replace` 创建新项目。

`0004_transcriptions.sql` 是新增迁移；既有迁移保留。`transcription_jobs` 保存 project ID、输入快照、状态、模型、结果和错误；在第一次外部 PUT 前落盘。并发重复提交通过 `INSERT OR IGNORE` 和输入比较收敛为同一记录。`submitting/queued/running/unknown` 仅查询原任务；未知结果不会自动创建新 ID。已知拒绝是失败，网络/无效响应是未知。

结果必须匹配任务 ID、音频哈希和语言。SQLite 保存结果，但刷新不会自动采用它；用户选择“采用为新项目”后，原稿保留。服务自行保存模型与引擎版本快照，并对服务重启留下的运行任务标为中断；不把新配置套到旧任务上。

原件放在 manifest 的 `audio-originals` 数据资源目录，包默认不携带预览数据。项目 JSON 限制 750 KB，音频 40 MB；最多 1200 行、6 小时字幕。便携项目导出把受限原件加入用户主动下载的 JSON；恢复时重新分块校验。仅删除项目时保留共享原件，避免其他项目失效。

## 验证

`pnpm workbench:check`、`pnpm test`、`pnpm package` 在项目根目录执行。测试以临时 SQLite 和文件目录验证导入/导出、草稿、文件、修订冲突、任务幂等、响应丢失与边界；假的 HTTP responder 只算契约测试。

真实 Chrome 与 tiny.en CPU 推理记录见项目根目录 `ACCEPTANCE.md`。独立服务的 Node 入口需先准备好服务；模型效果、硬件与语言范围以实际验证记录为准。Floatboat 客户端导入尚未测试。
