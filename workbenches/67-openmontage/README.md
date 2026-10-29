# 剪辑台 · OpenMontage

![剪辑台](../../docs/screenshots/openmontage.png)

多轨时间线剪辑台：把视频、图片、音乐和字幕放上时间线，修剪、分割、移动，加淡入淡出、交叉溶解、标题和字幕，调音量，在浏览器里预览，并导出真实的 MP4。不需要外部服务。OpenMontage 服务可选，用固定版本的官方工具做裁切拼接渲染。

## 运行

```sh
pnpm workbench prepare openmontage
pnpm workbench dev openmontage
```

打开后是示例影片《海边的一天 · 粗剪》，可以直接播放、修改、导出。示例素材由 `samples-src/generate.mjs` 用程序绘制、合成后经 FFmpeg 编码，均为原创，约 2.6 MB。

## 已实现

- **多轨时间线**：画面、音频、文字三类轨道，可增删和改名，可隐藏或静音，可调轨道音量。片段可拖动、换轨、拖边修剪（左修剪同步移动素材入点，受素材长度限制），在播放头处分割（S），删除，复制。吸附到播放头和片段边缘，按住 ⌘/Ctrl 滚轮缩放，撤销和重做。
- **转场与画面**：淡入、淡出、与上一段交叉溶解（后续片段自动前移），经黑场转场。画面可选填满或完整显示；静帧可推近、拉远、平移。
- **文字**：大标题、下方字条、字幕、角标四种样式，可调字号、颜色、位置、对齐、粗体和底衬。可导入 SRT/WebVTT 字幕到字幕轨，也可导出 SRT。
- **声音**：视频自带的声音、配乐轨、环境声轨分别调片段音量和轨道音量，淡入淡出同时作用于声音。
- **预览**：监视器按时间线实时合成，提供逐帧、首尾跳转和时间码（分:秒:帧）。
- **本机导出**：在浏览器里用 Mediabunny + WebCodecs 逐帧合成全部轨道并混音，输出 MP4（H.264 + AAC；本机不支持时用 WebM），可选分辨率与质量，可以取消。成片保存在成片架，可回看、下载，或放回素材库继续剪。
- **素材**：可导入 MP4、MOV、WebM、MKV、PNG、JPEG、WebP、GIF、MP3、M4A、WAV、OGG、FLAC，单个最大 2 GB。导入前读取时长与尺寸，确认本机能解码；不支持的文件会说明原因，同批其他文件照常导入。
- **影片菜单**：新建空白影片、打开示例、最近的影片、导入/导出完整工程 `.openmontage`（含素材，按内容哈希核对）、恢复稿、工程 JSON、剪辑单 Markdown、删除。
- **自动保存**：保存完整工作稿、未应用的 JSON 与时间数值输入；回执丢失时用同一 mutation 重试；冲突时保留草稿；有本机副本。导入工程总是新建影片；新建/切换影片时保护输入不被异步切换覆盖。

## OpenMontage 服务（可选）

导出对话框里显示服务状态、地址、启动命令和“重新检查”。服务需要 Node 22、Python 3.10+、Git 和 FFmpeg/ffprobe：

```sh
cd workbenches/67-openmontage/service
pnpm setup   # 在 service/.local/upstream 检出固定提交 e01dbf433f46eeb91d39bf905e194162921019a3
pnpm start   # http://127.0.0.1:8797
```

服务只处理主画面轨的 MP4 片段（单段 ≤20 MB、2–12 段、≤120 秒），用官方 VideoTrimmer 裁切、VideoStitch 统一为 720p/24fps 后硬切拼接。文字、转场、其他轨道请用本机导出。条件不满足时，界面会说明是哪一段、为什么。`OPENMONTAGE_SERVICE_URL`、`OPENMONTAGE_SERVICE_TOKEN`、`OPENMONTAGE_SOURCE`、`OPENMONTAGE_PYTHON`、`OPENMONTAGE_DATA` 的含义与 0.5 版相同。远程服务要求 HTTPS。

## 限制

本机导出需要支持 WebCodecs 的浏览器（Chromium 系 116+）。不含画中画位置/缩放关键帧、调色、变速、倒放和音频波形显示。素材在工作台数据目录中；普通源码包不含用户素材，也不含外部服务。单个 2 GB 是格式校验上限，实际导出受浏览器内存和编码器限制，未验证长片/上限负载。

打包：`pnpm workbench package openmontage`。导入：Floatboat → 我的 → 工作台 → 导入工作台。客户端导入未实测。上游 OpenMontage 源码使用 AGPL-3.0，Mediabunny 使用 MPL-2.0，许可原文随包保留。

[验收记录](ACCEPTANCE.md)区分本机验收、真实上游执行与合同测试。
