# 字幕剪辑室 0.4.0 验收

日期：2026-10-27。范围是本地工作台、外部 CPU 推理服务与真实 Chrome；Floatboat 客户端导入尚未验证。机器使用 Node 22.22.2、Python 3.12.13。结构化结果见 [acceptance-evidence.json](acceptance-evidence.json)。

## 已通过

- `pnpm workbench check faster-whisper`：manifest、依赖、TypeScript 和构建通过。保留大模块提示：共享 `autosave-client.ts` 和单页 `App.tsx`；无类型或构建错误，没有关闭检查。
- `pnpm workbench test faster-whisper`：**13 / 13** 行为测试通过；覆盖字幕格式与毫秒精度、无效时间草稿、Unicode 拆分、音频原件验证、版本冲突、任务持久化顺序、重复及并发提交、回执丢失后对账、取消和响应边界。
- 隔离 Python 环境内 `python -m unittest discover -s service -p 'test_*.py'`：**4 / 4** 队列测试通过，覆盖重复输入、冲突、取消、重启中断、模型配置快照和错误 digest。它们不算模型效果测试。
- Chrome：桌面 1440×1050、窄屏 375×900。完成 14 组交互检查，包括自动保存/重开、未完成时间草稿、保存延迟时继续编辑、服务已提交但回执丢失后的幂等重试、拆分/合并/复核、SRT 导出和新项目导入、音频原件落盘及真实波形/回听、真实转写提交与采纳、含音频便携项目往返、两个独立浏览器上下文的乐观冲突、无服务时仍可编辑和导出。服务不可用的 UI 分支使用响应注入，未冒称真实网络停机。
- 控件标签和键盘焦点可用；窄屏没有全页横向溢出，开启 reduced-motion 后主流程正常；浏览器无未处理 page error。
- 源码更新触发服务重启后，重新打开实际应用地址，音频、真实转写字幕与备注保留；回听第二句和继续修改再次通过。更新后的字幕行回调保持稳定引用，减少播放时的无关行重渲染。
- `pnpm workbench package faster-whisper`：成功生成 `artifacts/faster-whisper-studio-0.4.0.fbworkbench`；检查 ZIP 不含预览录音、数据库、模型或 node_modules。业务源文件 33 项（ZIP 共 34 条目）。

## 真实模型证据

通过浏览器选择普通英语示例音频（6.887 秒、224470 字节），调用工作台 Node 服务，再调用独立 Python 服务中的 **`WhisperModel.transcribe()`**。不是固定结果、Host ASR 或 mock provider。

- 库：faster-whisper **1.2.1**，CTranslate2 **4.8.4**，PyAV **16.0.1**。
- 模型：[Systran/faster-whisper-tiny.en](https://huggingface.co/Systran/faster-whisper-tiny.en)，revision `0d3d19a32d3338f10357c0889762bd8d64bbdeba`。
- 设备：CPU，INT8，4 threads。首次下载后本次完整浏览器链路使用已缓存权重；这不是对所有设备的速度保证。
- 实际返回：`0.000–1.520` “Welcome to the interview.”；`1.520–4.480` “Today we will discuss how to make clear subtitles.”；`4.480–6.880` “Please check every sentence before publishing.”
- 在界面采用结果创建了新项目；原稿内容通过 API 核对仍在。导出的 `.subtitle.json` 包含原音频，重导入后重新绘制波形并回听。

实测发现 PyAV **19.0.2** 与该 faster-whisper 版本不兼容：`av.open()` 已移除 `metadata_errors`。已把可运行的 PyAV 16.0.1 固定进服务锁定依赖，未修改上游库或吞掉失败。模型首次下载的 Xet 路线在本网络没有完成，改用 `HF_HUB_DISABLE_XET=1` 下载；缓存齐备后离线模式下完成推理。相关失败任务保留在开发预览队列，最终成功任务另有完整输出。

## 范围边界

真实模型验收只覆盖 tiny.en 英语 CPU 路线和上述短录音；没有验证其他语种、GPU、长音频质量、特定行业词汇准确率或并发容量。用户可配置其他上游模型，但不将未测试组合标为已通过。

默认的本地字幕编辑、自动保存、资源保存和导出不需要 Host。该应用 manifest 没有声明 Host ASR/LLM；本轮预览报告 `HOST_NOT_CONNECTED`，不影响已经真实运行的独立 Python 服务链路。客户端导入另行验收。

Python/模型与服务数据均不在 `.fbworkbench` 内，启动方式见项目 README。数据目录保存完整原件；模型取消是协作取消，不能强制抢占正在进行的原生计算或下载。当前页面是单用户审校台，未交付多租户、实时流转写、说话人分离或视频烧录。

截图为真实浏览器中的工作台，含实际音频波形、真实转写结果和人工复核状态，未合成或改像素；尺寸及 SHA-256 记录在结构化验收文件中。
