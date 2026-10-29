# 字幕剪辑室工程记录

## 执行边界

固定 Node22 / React19 / SQLite 模板；应用无新增 runtime npm 依赖，没有修改 CSP 或 SDK。`src/server/index.ts` 注册业务路由；浏览器使用 SDK page connection 同源访问。manifest capabilities 为空，因为本应用不调用 Host ASR/LLM。

Python 推理在同项目的 `service/` 独立运行，默认地址 http://127.0.0.1:8768。应用包只携带 Node/React 业务源码与示例，不包含 Python 或模型。安装说明见项目 `README.md`，源码：https://github.com/floatboatai/floatboat-workbenches/tree/main/workbenches/60-faster-whisper/service 。

### 为什么没有浏览器内转写后备

评估了 transformers.js（onnxruntime-web）的 Whisper，结论是在本模板中不可行：

1. **CSP**：工作台页面的策略是 `script-src 'self'`、`connect-src 'self'`，没有 `'wasm-unsafe-eval'`。真实 Chrome 里 `WebAssembly.compile()` 直接抛 `CompileError ... violates the following Content Security Policy`，向 huggingface.co 的 `fetch` 被拒（浏览器验收已记录）。onnxruntime-web 的 WASM 与 WebGPU 后端都需要编译 WASM；模型也无法在运行时下载。CSP 由 SDK 运行时设定，不属于本应用可改范围。
2. **体积**：即使打包进应用，whisper-tiny 量化 ONNX 约 40 MB、base 约 75 MB、small 约 250 MB，再加约 20 MB 的 ORT 运行时；`.wasm` 不在 SDK 静态 MIME 表里。tiny/base 的中文质量也不足以作为“可校对的初稿”。

因此首屏可用性改由“自带示例 + 全部校对与导出在页面内完成”保证，转写保持为外接能力。

## 模块

- `contracts/transcript.ts`：音频引用与按内容识别容器（`sniffAudio`）、字幕行（含 `speaker`、`words: {s,e,w,p}`）、说话人、保存/工作稿两级校验与 0.4 数据兼容、时间码、页面草稿字段。
- `contracts/options.ts`：`transcribe()` 参数的页面值、校验、默认值（旧任务/旧项目回落）与 snake_case 线格式；语言表。
- `contracts/edit.ts`：纯变换——按字符 LCS 的逐词时间重对齐（保留的字沿用识别时间，插入的字插值并标为人工修改 `p=-1`）、按播放头/所选词拆分、合并（中文不加空格）、入出点微调与设为播放头、查找替换（大小写、正则、`$1`）、按时间重叠沿用说话人。
- `contracts/subtitles.ts`：SRT/VTT（`<v 名字>`）与 faster-whisper 分段 JSON（`words`/`speaker`）导入；SRT/VTT/TXT/JSON 导出。
- `contracts/job.ts`：任务标识、输入快照（音频、语言、参数）、远端结果与运行信息（识别语言、置信、时长、VAD 后时长）。
- `contracts/sample.ts`、`server/sample-audio.ts`：示例字幕与 Ogg Opus 原件（base64，约 310 KB 源文本）。服务启动时按内容哈希写入音频目录；数据目录被清理后读取时也会补写。
- `server/files.ts`：1 MiB 有界分块、SHA-256、容器签名、临时文件原子重命名、内容寻址的 `ensure`。
- `server/jobs.ts`：先持久化再调用服务；固定任务 ID、并发去重、输入一致性；结果须匹配任务 ID、音频哈希、语言与 key 排序后的参数回显；状态未知后对账；健康检查区分未运行/令牌/版本/非本服务。
- `ui/App.tsx` 组合页面；`Timeline.tsx`（canvas 波形 + 区间/手柄/逐词轨，只渲染可视范围）、`CueRow.tsx`、`Inspector.tsx`、`TranscribePanel.tsx`、`Menus.tsx`、`FindBar.tsx`、`Monitor.tsx`；状态逻辑在 `useTranscription.ts`、`useFiles.ts`、`useFind.ts`、`usePlayer.ts`（以 8 kHz 解码出最多 6 万个峰值，支持缩放）。
- `ui/autosave-*`、`workspace.tsx`：沿用仓库自动保存协议，未改动。

## 数据与状态

字幕时间保留为字符串（可编辑草稿），逐词时间为秒数。保存模型要求合法时间、已命名的说话人、引用存在的说话人；工作稿允许未完成的值。项目 JSON 正式上限 880 KB（共享自动保存服务端 900 KB 上限之下），工作稿 1.25 MB；含逐词时间时约可容纳 1.5 小时中文语音。音频 200 MB，字幕 4000 行、6 小时。

`0005_job_info.sql` 为任务表加 `info` 列；既有迁移保留。任务输入 JSON 新增 `options`，旧行按默认参数解码。服务端（Python）任务表增加 `options`、`info` 列并自动迁移。

健康检查协议：`/health` 返回 `protocol: 2` 与 `multilingual`。旧版服务（无 protocol）显示“服务版本过旧”而非可用；英语专用模型禁用非英语语言与翻译。

## 验证

`pnpm workbench:check`、`pnpm test`、`pnpm package` 在项目根目录执行。30 项 Node 测试以临时 SQLite 与文件目录验证格式往返、重对齐、拆分合并、查找替换、说话人、参数线格式、回显不一致拒收、健康检查分类、示例完整性、旧数据兼容、草稿与任务幂等；假的 HTTP responder 只算契约测试。7 项 Python 队列测试覆盖参数快照与冲突。

真实 Chrome 与 small 模型 CPU 推理记录见项目根目录 `ACCEPTANCE.md`。Floatboat 客户端导入尚未测试。
