# 字幕剪辑室 · faster-whisper

面向访谈、课程与短视频剪辑：上传音频，转写为带时间戳的初稿，逐句回听、修订与复核，再交付 SRT、VTT 或逐字稿。

![字幕剪辑室](../../docs/screenshots/faster-whisper.png)

## 已实现的流程

- WAV、MP3、M4A/MP4、OGG、WebM、FLAC 原件分块上传，SHA-256 校验后保存到应用资源目录；最大 40 MB。浏览器支持的音频可回听并显示真实解码波形。
- SRT、VTT、faster-whisper 分段 JSON 导入。时间点、文字、复核状态、备注、未完成的时间输入与待导入文本自动保存；离线本机恢复、重试与版本冲突使用仓库现有保存机制。
- 字幕入点/出点修订、回听定位、中点拆分、与下一句合并、逐句复核、仅看待复核。
- 通过随仓提供的独立 Python 服务调用真正的 `WhisperModel.transcribe()`。任务先存入 SQLite，使用固定 ID 提交；刷新查询同一个任务，结果不会覆盖当前手工稿。采用结果创建独立项目。
- SRT/VTT/TXT 导出；`.subtitle.json` 便携项目包含原音频、当前稿和编辑草稿，重新导入创建新项目。

本地界面和字幕编辑无需模型服务。服务未连接时转写按钮不可用，但已保存资料、字幕审校和导出仍可使用。此应用不调用 Host ASR，也不将 Host ASR 冒称为 faster-whisper。

## 启动

在总仓库运行：

```sh
pnpm workbench prepare faster-whisper
pnpm workbench check faster-whisper
pnpm workbench test faster-whisper
pnpm workbench dev faster-whisper
```

打开预览打印的完整地址。转写需另开一个终端启动下方服务。

### 独立 CPU 转写服务

需要 Python 3.12 和 `uv`。在本项目目录执行：

```sh
uv venv .local/whisper-service --python 3.12
uv pip install --python .local/whisper-service/bin/python -r service/requirements.txt
.local/whisper-service/bin/python service/server.py \
  --data .local/whisper-jobs \
  --cache .local/whisper-models \
  --model tiny
```

默认监听 `127.0.0.1:8768`，默认 `tiny` 是多语言模型。首次转写下载所选权重；该过程由服务完成。英语快速验证可以选择 `--model tiny.en`；英语专用模型不接受显式的中文等其他语言。

本工作台默认访问上述 loopback 地址。外置到其他地址时，在**工作台服务进程**设置 `FASTER_WHISPER_URL` 为无路径、无凭据的 HTTP(S) 来源；如使用鉴权，两端设置相同的 `FASTER_WHISPER_TOKEN`。令牌不进入网页、项目或导出文件。非 loopback 监听强制要求令牌，需由部署环境提供传输保护。不要在 UI 中放模型服务密钥。

若所处网络无法完成 Hugging Face Xet 下载，可在首次启动前设置 `HF_HUB_DISABLE_XET=1`；下载完成后可设置 `HF_HUB_OFFLINE=1` 使用现有缓存。已核验组合为 faster-whisper 1.2.1、PyAV 16.0.1、CTranslate2 4.8.4、Python 3.12。不能直接升级到 PyAV 19：它移除了该版 faster-whisper 调用的 `metadata_errors` 参数。

服务代码、完整锁定依赖、队列测试与协议说明见 [service/](service/README.md)。模型、Python、CTranslate2 和服务数据库不包含在 `.fbworkbench` 中；导入 Floatboat 后仍需启动可访问的独立服务。更换为 GPU 或生产多用户服务需另行部署与验证。

## 使用与边界

1. 上传音频或导入字幕；点击句号编号可从该句开始回听。时间格式为 `时:分:秒.毫秒`。
2. 转写完成后选择“采用为新项目”。原手工稿保留，结果带模型和运行来源；重新转写不会直接覆盖当前稿。
3. 校对文字和时间，标记已复核，再导出字幕。字幕最多 1200 行、6 小时时间范围，项目结构数据最大 750 KB。
4. “导出完整项目”保留音频和草稿；只有 SRT/VTT/TXT 的导出不包含音频和复核记录。

取消属于协作取消：队列任务直接取消，正在执行的推理在返回分段时停止采纳结果；不是强制终止原生推理进程。服务重启时，正在推理的任务标为中断，不偷偷重跑。状态未知时先查询，再用原任务 ID 重试，避免产生第二个任务。

波形和回听依赖浏览器编解码器；原件仍可送入 Python/PyAV，浏览器无法播放时会给出提示。首版没有视频烧录、字幕翻译、说话人分离、实时麦克风流或长音频分片队列。音频文件按内容寻址共享，删除单个项目不删除其他项目可能仍引用的原件。

## 验收与许可

本地功能、真实模型、预览重启与客户端导入的边界见 [ACCEPTANCE.md](ACCEPTANCE.md)。上游代码 MIT；模型、PyAV/FFmpeg 等依赖的许可独立，见 [NOTICES.md](NOTICES.md)。没有在应用包里再分发模型或外部原生推理依赖。

打包：`pnpm workbench package faster-whisper`。产物在本项目 `artifacts/`；Floatboat 中通过「我的 → 工作台 → 导入工作台」导入。客户端实际导入尚未验收。
