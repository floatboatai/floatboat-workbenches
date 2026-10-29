# 字幕剪辑室 0.9.0 验收

日期：2026-10-29。Node 22.23.4、pnpm 10.22.0、Python 3.12、Chrome for Testing（Playwright 驱动，headless）。功能验收与结构审查分开记录。结构化结果见 [acceptance-evidence.json](acceptance-evidence.json)。

## 之前 → 现在

| | 0.4.1 | 0.9.0 |
| --- | --- | --- |
| 首次打开 | 空项目；转写按钮在服务未连接时禁用，没有启动方法 | 直接打开自带的 82 秒原创双人访谈与真实 faster-whisper small 逐词转写稿，无需任何服务即可校对和导出 |
| 服务未连接 | 一行“服务未连接” | 状态、可复制的启动命令和“重新检查”就在“开始转写”上方；按钮写明不可用原因；区分未运行/令牌不符/版本过旧/非本服务 |
| 上游能力 | `beam_size=3`、`vad_filter=False`、`word_timestamps=False` 写死，只有语言可选 | `task=translate`、`word_timestamps`、`vad_filter`+最短静音、`beam_size`、`initial_prompt`、`hotwords`、`condition_on_previous_text`、34 种语言；参数进入不可变任务快照并由服务回显校验；返回逐词置信与识别语言/VAD 时长 |
| 校对 | 改字、改时间、中点拆分、合并 | 逐词时间与置信、改字后重对齐、可缩放波形上拖动入出点并吸附词边界、±0.1/0.5 与设为播放头、按播放头/所选词拆分、查找替换（大小写/正则）、说话人名册与标注、低置信筛选、Ctrl/⌘ Enter 复核下一句、撤销删除、快捷键 |
| 导出 | SRT/VTT/TXT | SRT/VTT（`<v>`）/TXT（说话人、时间）/JSON（分段+逐词+说话人，可再导入），完整项目含音频 |
| 真实输入 | 40 MB、按扩展名判断 6 种 | 200 MB，按内容识别 WAV/MP3/AAC/M4A/MP4/MOV/OGG/Opus/WebM/MKV/FLAC/AIFF；4000 行 |
| 页头 | 项目选择器 + 新建按钮 | “字幕稿”与“导出”菜单，原生对象是字幕稿 |

## 功能验收（本机，`local-verified`）

- `pnpm workbench check faster-whisper`：manifest、依赖、TypeScript 与构建通过。保留两条大模块提示：共享 `autosave-client.ts`（未改动）与 `App.tsx`（629 行，已从 1103 行拆出 9 个模块）。
- `pnpm workbench test faster-whisper`：**30 / 30**（原 15 项全部保留并改到新接口，新增 15 项）：0.4 数据兼容；示例音频哈希与示例字幕一致、严格校验、真实错字与低置信保留；示例原件按内容写入且幂等；逐词重对齐（中文改字、英文插词、标点）；按播放头拆分与合并；入出点不越界；查找替换（单个/全部/正则 `$1`/非法正则）；VTT `<v>` 往返与 SRT/TXT 说话人；JSON 往返保留逐词与人工修改标记；faster-whisper words 映射与说话人沿用；参数校验与线格式；容器识别与 200 MB；连接器发送参数、拒收参数回显不一致的结果、保存运行信息；健康检查四种状态（不含原始 “fetch failed”）；未命名说话人与未完成时间的草稿可恢复但不可导出。
- Python：`python -m unittest discover -s service -p 'test_*.py'` **7 / 7**（参数进入任务快照、不同参数同 ID 冲突、未知/越界参数拒绝、英语专用模型拒绝翻译、重启中断、取消、模型快照）。

真实浏览器，空数据目录、无 Floatboat Host（`HOST_NOT_CONNECTED`）、转写服务未启动，共 **46 项**检查全部通过（1440×960）：

- 首次打开自动生成示例字幕稿：12 句、12 个按说话人着色的波形区间，波形画布 20% 像素有墨迹（真实解码）。回听第 3 句后时间前进、当前字幕逐词点亮；本句显示逐词与置信。
- 查找“执办”→1/1→全部替换为“值班”；正则 `(\d+)名`→“二十名”；在所选词“招”前拆分为 13 句、首句以“合作,”结束；合并回 12 句。第 10 句入点 −0.5×2（63.830→62.830）并补字“最后，”；放大 100 px/秒后键盘 → 微调出点（+0.1 秒）、鼠标拖动第 11 句入点（68.230→67.635），逐词轨显示。说话人改名后所有行同步。
- “转写”页：未连接时显示 `service/server.py` 启动命令、“重新检查”，开始按钮禁用且说明“服务未连接。现有字幕仍可校对与导出”；无 “fetch failed”。重新检查后仍正确显示未连接。
- Ctrl+Enter 复核第 5 句并把焦点移到第 6 句。导出 SRT（`林夏（主持）：欢迎收听…`、含替换结果）、VTT（`<v 周明远>`）、TXT（说话人段落）、JSON（12 段、逐词、说话人）；刷新后所有修改保留。
- 页面内 `WebAssembly.compile()` 被 CSP 拒绝，`fetch("https://huggingface.co/")` 被拒——浏览器内 Whisper 后备不可行的直接证据。除这两条故意触发的 CSP 报错外无 console 错误与 pageerror。
- 自动保存：保存请求被延迟 3.5 秒期间继续输入，刷新后完整新文本保留；服务器已提交但响应被重置后重试，项目数不变；输入非法出点 `00:00:1` 显示“草稿已自动保存，待完善输入”，刷新后原样恢复，导出 SRT 被拦截并提示时间格式；导入 SRT 新建字幕稿、示例稿仍在最近列表；菜单 Escape 关闭并把焦点还给菜单按钮；导入 15 秒 M4A 新建字幕稿并解码波形；“在播放头加一句”。console 仅有故意断开连接产生的 `ERR_CONNECTION_RESET`。
- 375×812：全页无横向溢出（本句、说话人、转写三页分别为 0；修复了启动命令块撑宽检查器的问题）；回听；字幕稿菜单全宽浮层位于屏内；reduced-motion 打开正常；无 console 错误。

## 真实模型（本机 faster-whisper，`real-model-verified`）

独立 Python 服务（faster-whisper 1.2.1、CTranslate2 4.8.4、PyAV 16.0.1），模型 [Systran/faster-whisper-small](https://huggingface.co/Systran/faster-whisper-small) revision `536b066…`，CPU int8，缓存后 `HF_HUB_OFFLINE=1`。浏览器 → 工作台 Node → Python `WhisperModel.transcribe()`，9 项检查通过：

- 连上后“转写”页展开参数；示例稿预填 `initial_prompt`（人名、地名、栏目）。提交 `language=zh, task=transcribe, word_timestamps, vad_filter(500ms), beam_size=5`，完成后队列显示“识别为 zh（100%）· 音频 82.2 秒，VAD 后 65.9 秒”。
- 采用为新稿：12 句全部按时间重叠沿用了原稿的说话人；首句变为“欢迎收听《街区来信》。我是林夏,今天我们来到梧桐路社区图书馆。”——只用通用提示词时同一模型输出“街区来信…吴同路”，提示词修正了专名；新稿带真实逐词时间。
- `task=translate`：参数确实传入（服务任务表记录 `"task": "translate"`），任务完成并采用为“英译稿”。但 **small 模型对这段中文仍输出中文原文**；单独用 Python 对比无提示词与英文提示词，结果相同。界面在选择翻译时提示需 medium 或 large-v2/v3。翻译质量本身未验证。
- 示例字幕稿本身就是这一模型在同一音频上的真实输出（前 4 句人工校对），见 [NOTICES.md](NOTICES.md)。

真实 Floatboat Host 未测（本应用不调用 Host）；LLM 未调用。

## 结构审查（单独结果）

按 `docs/design-principles.md`：主对象是字幕稿与它的字幕行；首屏即有内容。文件生命周期全部收进“字幕稿”“导出”两个菜单，页头只剩名称、保存状态、转写状态胶囊；去掉了项目选择器 + 新建按钮。主区是字幕表（1440 宽下约 74% 宽度），波形监看在上，检查器在右侧按需切换“本句/说话人/转写”，转写是上下文工具而不是首屏主角。主操作贴着对象：回听在句号、入出点在波形与本句、复核在行尾、转写按钮旁就是服务状态与启动命令。对照 wavesurfer.js（区间批注为主、无字幕表）与 PageIndex 0.9.0（原页 + 目录 + 审阅三栏、“文档”菜单），本项沿用“产品菜单收纳文件”的惯例，但空间以时间轴 + 字幕表组织。1440 与 375 均走通新建、打开、导入、恢复和主业务动作，菜单 Escape 与焦点返回已验。结论：结构整改完成，待主线整合时复核记录。

## 未覆盖与限制

- Floatboat 客户端导入 `.fbworkbench` 未实测；真实 Host 未测。
- 浏览器内转写后备未实现（CSP 与体积原因见 `app/ENGINEERING.md`）。在 Floatboat 中导入后仍需另行启动 `service/`。
- 只验证了 small 中文与此前的 tiny.en 英文 CPU 路线；未验证 GPU、长音频、其他语种、翻译质量与并发。
- 说话人靠人工标注，没有声纹分离；没有视频烧录与实时流。
- 波形对 1 小时以上音频以 8 kHz 解码、最多 6 万个峰值，未做 2 小时以上文件的浏览器性能实测；200 MB 上限只做了契约测试与 M4A 小文件实测。
- 正式字幕稿上限 880 KB（共享自动保存服务端为 900 KB），含逐词时间约 1.5 小时中文语音。
- 改字后的逐词时间是按字符插值，不是重新强制对齐；需要精确对齐时重新转写。

## 产物

`pnpm workbench package faster-whisper` → `artifacts/faster-whisper-studio-0.9.0.fbworkbench`（哈希见 acceptance-evidence.json）。截图 `docs/screenshots/faster-whisper.png` 为真实浏览器中的示例字幕稿（1440×960，未改像素）。
