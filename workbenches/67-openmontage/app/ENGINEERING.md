# OpenMontage 剪辑台工程说明

## 数据模型（`src/contracts/`）

- `timeline.ts`：`Timeline { version: 2, brief, settings{width,height,fps,background}, assets[], tracks[], clips[], outputs[] }`。片段字段：`start`（时间线起点）、`in`（素材入点）、`duration`、`volume`、`fadeIn/fadeOut`、`fit`、`motion`，文字片段另有 `text/style`。`timelineValue` 校验轨道种类与素材类型匹配、片段不超出素材长度、偶数画幅、帧率等，并把 0.5 版 `{brief, shots}` 转为主画面轨顺序片段（没有原片的镜头转为说明字卡）。交叉溶解统一表示为“片段重叠 + 后一段淡入”，`envelope()` 同时控制不透明度和音量。
- `edit.ts`：纯函数编辑操作，包括添加、移动/换轨、左右修剪（受素材长度约束，左修剪同步移动入点）、分割、交叉溶解（后续片段整体前移）、波纹删除、吸附、轨道增删。撤销栈在界面层保存整份时间线快照，同一字段的连续输入合并为一步，成片记录不参与撤销。
- `media.ts`：按文件头识别素材格式并核对 MIME，校验素材记录（2 GB 上限）。`subtitles.ts`：SRT/VTT 解析与 SRT 导出。`samples.ts`：示例素材的哈希、大小、时长和示例影片。
- `render-plan.ts`：与浏览器无关的导出计划，包括每个视频片段的帧区间和要解码的素材时间戳，以及每个有声片段的增益包络（片段音量 × 轨道音量 × 淡入淡出）。
- `service-plan.ts` / `montage.ts`：把主画面轨转换为 OpenMontage 服务的 0.5 版计划格式（服务代码直接导入 `readyMontage` 做同一校验），并列出服务不支持的内容。

## 浏览器引擎（`src/ui/engine/`）

- `compose.ts`：预览和导出共用的合成函数。视频轨自下而上叠放，文字轨在最上层；支持填满/完整显示、推拉平移和淡入淡出；文字中文逐字折行、英文按词折行，底衬或阴影二选一。
- `player.ts`：每个邻近片段对应一个 `<video>/<audio>` 元素，src 为同源 `/api/media/:id`，靠 Range 请求拖动定位。用 `performance.now()` 作主时钟，偏差超过 0.25 秒时纠正；暂停时精确定位到帧，`seeked/loadeddata` 后立即重画（页面在后台时 rAF 可能暂停）。播放头时间通过 `useSyncExternalStore` 只驱动时间码和播放头，不重渲染整条时间线。
- `export.ts`：Mediabunny 1.61.4 以 `UrlSource`（Range）读取素材，`CanvasSink.canvasesAtTimestamps` 按帧顺序解码，在 OffscreenCanvas 上逐帧合成，交给 `CanvasSource` 用 WebCodecs 编码；声音用 `AudioBufferSink` 只解码所需区间，在 `OfflineAudioContext` 里按增益包络混音后交给 `AudioBufferSource`。编码组合按 MP4（AVC+AAC）→ WebM（VP9/VP8+Opus）→ MP4（AVC+Opus）的顺序，取第一个本机能编码的。导出可以取消。成片上传到素材存储，记入 `outputs`（成片架）。

CSP 为 `script-src 'self'`、`media-src 'self' blob:`、`connect-src 'self'`，不允许 wasm 和 blob worker，所以不用 ffmpeg.wasm。用到的 Mediabunny 路径都不创建 worker（它只在 MediaStream 源和透明通道视频处用 blob worker，本应用不走这两条路径）。

## 服务端（`src/server/`）

- `files.ts`：上传按 1 MiB 分块，每块 base64 编码后放进 JSON 请求（SDK 请求体上限 2 MB）。`finish` 按顺序合并分块，同时计算 SHA-256，以 `<sha>.media` 命名并原子发布；同一内容重复上传只保留一份。读取支持 `Range`（206/416）和 `?download=` 文件名。示例素材从工作台自带的 `samples` 资源读取，0.5 版的 `<sha>.mp4` 原件仍可读。
- `routes.ts`：项目 CRUD、自动保存（保存前核对素材和成片文件是否存在；缺失时存为草稿，不判成版本冲突）、素材上传与读取、OpenMontage 服务代理（`/api/renderer` 返回 `state/message/command/url`，渲染任务的幂等提交、核对、取消和下载沿用 0.5 版）。
- 迁移未改：0001–0004。

## 文件

`samples/` 为项目资源（约 2.6 MB），随工作台包分发。`media` 为数据资源。`samples-src/generate.mjs` 是示例素材的生成脚本，不进入工作台包。许可：`notices/OpenMontage-LICENSE.txt`（AGPL-3.0，上游服务）、`notices/mediabunny-LICENSE.txt`（MPL-2.0）。

## 工作稿与文档切换

`fields.tsx` 通过 `NumericDrafts` 把未应用数值写入 `draft.numericFields`，以片段 ID 和字段名称为键，保留输入文本及编辑时模型值。自动保存同时保存模型、名称与 `extra`，因此数值、JSON 和空名称可跨刷新及恢复稿导入保留；模型变化后不把旧数值草稿套到新模型上。有效值在回车或失焦时应用，Escape 清除当前输入。`useProduction.replace` 与 `open` 一样，在等待旧稿保存和重置文档期间设置 `transitioning`，防止快速新建覆盖新输入；后台自动保存不锁编辑。

本轮浏览器脚本与成片保存在工作区 `archive/2026-10-29-workbench-depth/openmontage/`。服务使用独立数据库、`hostConnection: null`，不执行 Host 发现；浏览器限制为当前本机服务 origin。故障注入仅针对本机自动保存与不存在的素材。

## 验证命令

```sh
# 在 workbenches/67-openmontage，使用 Node 22.x；以下命令串行运行。
pnpm workbench:check
pnpm test                      # 应用 25 项
pnpm --dir service test        # 服务 4 项
pnpm package
```

`check` 与 `test` 都会生成同一个 `app/sdk` 目录，同时运行可能触发 `ENOENT unlink`；串行可通过。本轮仅记录这一共享工具链行为，未修改共享脚本。

必须先定稿 REQUIREMENTS / DESIGN / ENGINEERING 再打包。若默认同版本包存在，先移入 archive，pack 不覆盖旧包。验包时逐字节比较 `application/` 的所有打包源码及三份文档；manifest 仅允许模板规范化 resources。示例、许可与 SETUP 是声明资源，单独比对 `assets/`；业务数据排除。模板只打包固定文档清单，`app/ACCEPTANCE.md` 留在仓库供审阅。

2026-10-29 本机成片经 ffprobe 核验：桌面 1280×720、30fps、H.264 + AAC，画面 58.2 秒；375px 页面导出 854×480、30fps、H.264 + AAC，画面 12.033 秒。容器时长略长来自 AAC 帧填充。没有真实 Host/LLM 调用，Floatboat 客户端导入未验证；可选 OpenMontage 服务仅重跑合同/存储测试和未连接界面，未重跑官方 Python 渲染。
