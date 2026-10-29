# 字幕剪辑室 · faster-whisper

面向访谈、播客、课程与短视频：用 faster-whisper 出带逐词时间的初稿，在波形上逐句回听、改字、对齐入出点、标注说话人，再交付 SRT、VTT、逐字稿或 JSON。

![字幕剪辑室](../../docs/screenshots/faster-whisper.png)

## 打开就能校对

首次打开即是“梧桐路图书馆访谈 · 示例”：一段 82 秒的原创双人访谈（主持人林夏、馆长周明远），配 faster-whisper small 的真实逐词转写。前 4 句已人工校对，后 8 句保留模型原样的错字与低置信词，可以直接练手。不需要启动任何服务。

- **波形对齐**：真实解码的波形，字幕区间按说话人着色；放大到 50–400 px/秒后显示逐词轨。区间两端可拖动（吸附到词边界，Alt 关闭），聚焦后 ←/→ 微调 50 ms（Shift 10 ms）。
- **逐词时间戳**：当前字幕按词点亮；“本句”里每个词显示时间与置信，低于 50% 描黄，可按词回听、在所选词前拆分。改字后逐词时间按字符重对齐，新输入的字标为“人工修改”。
- **入出点微调**：±0.1 / ±0.5 秒、“设为播放头”（快捷键 `[` `]`），字速超过建议值时提示。
- **拆分 / 合并**：以播放头或所选词为界拆分，合并时中文不插空格；删除可撤销。
- **查找替换**：大小写、正则（替换中可用 `$1`），逐个定位或全部替换。
- **说话人**：名册增删改、逐句或批量标注；VTT 写 `<v 名字>`，SRT/TXT 写“名字：”；导入 VTT 时识别 `<v>`；重新转写同一音频时按时间重叠沿用原说话人。
- **复核**：逐句复核、只看待复核或含低置信词的句子；在对白框里 Ctrl/⌘ Enter 复核并进入下一句。
- **导出**：SRT、WebVTT、TXT（可带时间）、JSON（分段 + 逐词 + 说话人，可再导入），以及含原音频与草稿的完整项目 `.subtitle.json`。

文件都在“字幕稿”菜单：新建空白稿、打开示例、导入音频或视频（WAV、MP3、AAC、M4A/MP4/MOV、OGG/Opus、WebM/MKV、FLAC、AIFF，按内容识别，最大 200 MB）、导入 SRT/VTT/JSON/完整项目、粘贴字幕、最近字幕稿、删除。导入一律新建字幕稿，原稿不动。编辑自动保存；离线、草稿与冲突有重试、导出恢复草稿和打开服务端版本。

## 转写（可选，本机 faster-whisper 服务）

右侧“转写”页的“开始转写”按钮上方就是服务状态、启动命令和“重新检查”。未连接时按钮禁用并说明原因，校对与导出不受影响。

需要 Python 3.12 和 `uv`。在仓库根目录：

```sh
cd workbenches/60-faster-whisper
uv venv .local/whisper-service --python 3.12
uv pip install --python .local/whisper-service/bin/python -r service/requirements.txt
.local/whisper-service/bin/python service/server.py \
  --data .local/whisper-jobs --cache .local/whisper-models --model small
```

默认监听 `127.0.0.1:8768`。首次转写下载所选模型权重；中文建议 `small` 或更大（`tiny` 中文质量差，`tiny.en` 只支持英语）。网络无法完成 Hugging Face Xet 下载时先设 `HF_HUB_DISABLE_XET=1`；缓存齐备后可设 `HF_HUB_OFFLINE=1`。

连上后开放 `WhisperModel.transcribe()` 的参数：语言（自动识别或 34 种指定语言，含粤语）、`task`（转写 / 翻译为英语）、`word_timestamps`、`vad_filter` 与最短静音、`beam_size`、`initial_prompt`、`hotwords`、`condition_on_previous_text`。参数随字幕稿保存，示例稿已预填人名地名提示词。结果进队列，显示识别语言、置信与 VAD 前后时长；“采用为新稿”生成新的字幕稿，原稿保留。

翻译只能译成英语。实测 small 模型对这段中文仍输出原文，需要译文请用 medium 或 large-v2/v3。

浏览器内转写（transformers.js 等）不可行：工作台页面 CSP 不允许编译 WebAssembly、也不允许连接外部模型仓库，打包模型还要额外 40–250 MB。详见 `app/ENGINEERING.md`。

### 外置部署

工作台服务进程可用 `FASTER_WHISPER_URL` 指向无路径、无凭据的 HTTP(S) 来源（HTTP 仅限回环地址）；两端设置相同的 `FASTER_WHISPER_TOKEN` 启用鉴权，令牌不进入网页、项目或导出文件。非回环监听强制要求令牌。已核验组合：faster-whisper 1.2.1、PyAV 16.0.1、CTranslate2 4.8.4、Python 3.12；不能直接升级到 PyAV 19（移除了该版 faster-whisper 调用的 `metadata_errors`）。服务说明与协议见 [service/](service/README.md)。模型、Python、CTranslate2 与服务数据库不包含在 `.fbworkbench` 中；在 Floatboat 中导入后，需要另外取得本仓库的 `service/` 并启动。

## 开发

```sh
pnpm workbench prepare faster-whisper
pnpm workbench check faster-whisper
pnpm workbench test faster-whisper
pnpm workbench dev faster-whisper
pnpm workbench package faster-whisper
```

产物在 `artifacts/`；Floatboat 中通过「我的 → 工作台 → 导入工作台」导入（客户端导入尚未验收）。

## 边界

取消是协作取消：排队任务直接取消，正在推理的任务在返回分段时停止采纳，不强制终止原生进程。服务重启时正在推理的任务标为中断，不偷偷重跑。状态未知时先查询，再用原任务 ID 重试。

faster-whisper 不做说话人分离，说话人由人工标注（或沿用原稿）；没有视频烧录、实时麦克风流或长音频分片队列。正式字幕稿上限 880 KB（含逐词时间约 1.5 小时中文语音），工作稿 1.25 MB，4000 行、6 小时。波形和回听依赖浏览器编解码器，浏览器无法播放时原件仍可送入服务。音频按内容寻址共享，删除字幕稿不删除其他稿可能引用的原件。

本地功能、真实模型、Host 与客户端导入的验收边界见 [ACCEPTANCE.md](ACCEPTANCE.md)；许可见 [NOTICES.md](NOTICES.md)。
