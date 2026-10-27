# AI 创意与语音工作台候选

核查日期：2026-10-27。范围为 10 个真实 GitHub 上游，覆盖转写、字幕、配音、图像制作、视频生成和演示文稿。仅核查官方仓库、源码、文档与模型卡；**未安装推理服务、下载权重、运行模型、验证真实 Host、构建 Floatboat 包或导入客户端**。下面的产品流程、界面和工作量均为设计建议，不表示上游已经实现这些工作台。

## 建议先做的三个产品

| 顺序 | 上游 → 工作台产品 | 能独立完成的任务 | 接入判断 | 首版工作量估计 |
|---|---|---|---|---|
| 1 | faster-whisper → 音视频字幕审校台 | 导入录音/视频音轨，转写、逐句回听、修订时间轴，交付字幕与逐字稿 | A；单独 Python 服务；CPU 可起步 | 4–7 人日 |
| 2 | Presenton → 提案与培训课件制作台 | 导入提纲/文档，审阅逐页内容，生成和修改课件，交付可编辑 PPTX/PDF | A；对接已有 Docker 服务，原样搬入整站成本高 | 7–12 人日 |
| 3 | Kokoro → 多语言旁白制作台 | 按段落编排脚本，选择声音、试听重做，交付分段及整条旁白 | A（有条件）；先用 Python 服务，评估维护停滞风险 | 5–8 人日 |

这些产品分别交付字幕、课件和音频，业务闭环明确。Host 已有 ASR 时，字幕台的价值应放在长音频批处理、可复现模型、时间轴审校和导出；Host 已有 LLM 时，课件台的价值在版式和可编辑文稿，不再做一个聊天框。Kokoro 先做固定声音配音，不把克隆任意人物声音列为能力。

工作量按一名熟悉模板的工程师、单用户 MVP、已有可用推理/API 服务估算，含业务 UI、持久化、适配器和一轮实际验收；不含 GPU 采购、模型训练、多租户服务、全量模型许可清单、线上容量评测和运维。若服务尚未存在，必须另排部署和模型实测。

## 共同接入边界

按当前任务提供的模板约束评估：React 19、Node 22、SQLite、纯 JavaScript 服务端，固定 CSP 的 `script-src 'self'` 与 `connect-src 'self'`。**Python、CUDA、PyTorch、CTranslate2、系统 FFmpeg、ONNX 原生扩展和 Docker 都不能视为工作台自带运行时。** 默认路线是 React 业务界面 → 同源 Node API → 已部署的独立推理服务；本地伴随服务的安装、启动、权限和网络可达性仍需另行验证。

浏览器不能直接连接模型服务器端口、远端模型下载域名或其 WebSocket；进度、预览和下载均应经同源适配层。服务端是否能访问目标端点也需要真机验证。模型大文件放在外部服务的缓存/文件存储，SQLite 保存项目、参数、修订稿、任务 ID、模型版本与产物引用。

Host 的 LLM/Agent/ASR 能力不等同于任意上游要求的 OpenAI HTTP API。需要明确协议适配；当前 `localHost` 未连接，不能把演示结果写成真实 Host 验收。三个首选都应保留人工修改、导入已有结果和恢复草稿的能力，并采用仓库既有自动保存契约。

## 1. faster-whisper：音视频字幕审校台

- **上游与定位：**[SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper)。面向访谈编辑、课程制作人员和多语种内容团队；它是 CTranslate2 推理库，不是完整字幕应用。
- **上游能力与接口：**Python `WhisperModel.transcribe()` 返回分段迭代器和语言信息；`word_timestamps=True` 返回逐词时间，另有批处理与 VAD。没有把内置 HTTP API 当作已存在能力；应自行封装任务服务。SRT/VTT/TXT/项目 JSON 由工作台适配层从结果生成。[官方用法](https://github.com/SYSTRAN/faster-whisper#usage)、[结果结构源码](https://github.com/SYSTRAN/faster-whisper/blob/master/faster_whisper/transcribe.py)。
- **工作流与布局建议：**左侧素材/转写任务，中部字幕行与原文/译文列，底部波形与播放头，右侧断句、时间偏移和术语面板。导入 → 选择语言和模型 → 转写 → 点击词句回听 → 修订/合并/拆行 → 导出字幕。翻译使用另行配置的 LLM，不混同 Whisper 自带的英文翻译任务。
- **运行条件：**Python ≥3.9；CPU INT8 可运行，GPU 路线当前文档要求 CUDA 12 的 cuBLAS、cuDNN 9；PyAV 自带 FFmpeg 库，单纯转写不要求系统 FFmpeg。官方 CPU small/INT8 样例约 1.48 GB RAM、GPU large-v2/INT8 约 2.93 GB VRAM，均是特定基准配置，不能当作所有音频/模型的最低配置；视频提轨、烧录字幕应另设媒体处理服务。[依赖及基准](https://github.com/SYSTRAN/faster-whisper#requirements)。
- **代码许可：**[MIT](https://github.com/SYSTRAN/faster-whisper/blob/master/LICENSE)。**模型许可单列：**选定的 [Systran/faster-whisper-large-v3](https://huggingface.co/Systran/faster-whisper-large-v3) 转换权重模型卡标记 MIT；这是具体 checkpoint 的结论，不能推广到任意微调模型。其源模型 [openai/whisper-large-v3](https://huggingface.co/openai/whisper-large-v3) 的 HF 页面另标 Apache-2.0，交付时需保留下载来源、revision 和附带许可；VAD 等附加模型也应单列。
- **判断：A，难度中，4–7 人日。**先做单文件离线转写和可靠导出，再增加批量队列。与 Host ASR 的区分是可控的本地/私有推理与编辑流程，不能只包装一次 ASR 调用。

## 2. Presenton：提案与培训课件制作台

- **上游与定位：**[presenton/presenton](https://github.com/presenton/presenton)。适合销售提案、培训材料和研究汇报；从提示、文档或模板生成可编辑演示文稿。
- **上游能力与接口：**`POST /api/v1/ppt/presentation/generate`，支持 `content`、逐页 `slides_markdown`、语言、模板、页数与 `export_as: pptx|pdf`；文件先走 `/api/v1/ppt/files/upload`，返回演示文稿 ID、产物路径和编辑地址。当前服务使用用户所属 API key。`slides_markdown` 仍会调用 LLM 做版式选择和字段映射，并非确定性 Markdown 排版器。[官方 API 示例及边界](https://github.com/presenton/presenton#-generate-presentation-via-api)。
- **工作流与布局建议：**左侧逐页缩略图，中间幻灯片舞台，右侧原始资料、版式和引用；先锁定提纲再生成，允许单页重做、手工修改、对照来源和导出。首版可让用户在 Floatboat 完成材料与大纲审阅，通过外部编辑器深度修改；完整重建拖拽编辑器应另列范围。
- **运行条件：**官方 Dockerfile 使用 Python 3.11、Node 22 和 Chromium，后端要求 `>=3.11,<3.12`；包含 FastAPI/Next.js 等完整服务，不能因同用 Node 22 就原样塞入模板。接云端 LLM 时不要求本机推理 GPU；Ollama 或自托管生图的硬件需求取决于各自模型。[Dockerfile](https://github.com/presenton/presenton/blob/main/Dockerfile)、[后端依赖](https://github.com/presenton/presenton/blob/main/servers/fastapi/pyproject.toml)。
- **适配重点：**调用 Docker/self-host 部署的 REST API；当前 README 明确 Electron 版的本地 HTTP 仅供应用内部使用，外部 REST/MCP 不可用。服务端返回的 `path` 要转成工作台同源下载，不能把容器内路径直接当用户文件。若要复用 Host LLM，需另做提供方协议转换。[部署和 API 鉴权说明](https://github.com/presenton/presenton#api-and-mcp-authentication)。
- **代码许可：**[Apache-2.0](https://github.com/presenton/presenton/blob/main/LICENSE)，保留 NOTICE。**模型许可：**项目没有一份覆盖所有 LLM/生图模型的统一权重许可；云 API 按供应方条款，自托管模型逐 checkpoint 核查。图片、模板、字体及上传 PPTX 的授权也不由主代码许可证覆盖。
- **判断：A，难度中高，7–12 人日。**适合优先做资料→大纲→生成→导出闭环；完整内嵌上游编辑器并通过 CSP 需单独探针和增量排期。

## 3. Kokoro：多语言旁白制作台

- **上游与定位：**[hexgrad/kokoro](https://github.com/hexgrad/kokoro)。82M 参数 TTS，适合短视频旁白、产品讲解、课程段落和多语言试听。模型卡列出 v1.0 的 8 种语言与 54 个声音，包含中文；不同语言和声音仍需真实试听。[模型卡](https://huggingface.co/hexgrad/Kokoro-82M)。
- **上游能力与接口：**Python `KPipeline(lang_code=...)`，输入文本、voice、speed，逐段返回文本/音素/音频；官方示例输出 24 kHz WAV。主库不是现成 REST 服务，需封装分段合成接口；跨段拼接、响度控制、导出清单由工作台新增。[官方用法](https://github.com/hexgrad/kokoro#usage)、[pipeline 源码](https://github.com/hexgrad/kokoro/blob/main/kokoro/pipeline.py)。
- **工作流与布局建议：**中部为分段脚本，段落旁显示时长与试听，底部旁白轨，右侧语言/声音/速度。导入脚本 → 分段 → 批量合成 → 单段重做 → 试听衔接 → 导出分段 WAV、合并 WAV 与脚本清单。首版固定声音；无须建立声纹克隆流程。
- **运行条件：**Python `>=3.10,<3.14`、PyTorch、Misaki；官方代码自动选择 CUDA 或 CPU，部分语言依赖及 espeak-ng 需要随独立服务准备。未找到可对所有语言/文本长度通用的最低内存保证。[包声明](https://github.com/hexgrad/kokoro/blob/main/pyproject.toml)、[设备选择](https://github.com/hexgrad/kokoro/blob/main/kokoro/pipeline.py)。
- **浏览器路径不能直接承诺：**同仓库 `kokoro-js` 确有 WASM/WebGPU 和 Node CPU 入口，使用 ONNX 权重；这不是 Floatboat 兼容性证明。WASM 编译、worker、远端权重下载和 Node 原生运行时都必须逐项验证；固定 CSP 下先采用 Python 服务。[JS 实现用法](https://github.com/hexgrad/kokoro/blob/main/kokoro.js/README.md)。
- **代码许可：**[Apache-2.0](https://github.com/hexgrad/kokoro/blob/main/LICENSE)。**模型许可：**[hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) 为 Apache-2.0，模型卡另列训练数据归属信息；若换 ONNX 转换版、声音包或衍生权重，另记其来源和许可，不把 Python 路径的结论直接套过去。
- **判断：A（有条件），难度中，5–8 人日。**许可和轻量模型适合作首批 TTS，但上游最后推送停在 2025-08，需锁依赖并安排 CPU/中文试听探针；不能用“82M”推导实时速度。

## 4. WhisperX：带说话人轨道的访谈精编台

- **上游与定位：**[m-bain/whisperX](https://github.com/m-bain/whisperX)。在转写之外增加强制对齐与说话人分离；适合访谈、播客和多人会议逐字稿，而不是再做一个普通字幕台。
- **上游能力与接口：**Python 流程为 `load_model → transcribe → load_align_model/align → DiarizationPipeline → assign_word_speakers`；CLI 原生 writer 提供 TXT、VTT、SRT、TSV、JSON。说话人标签是录音内编号，需要人工命名，不代表已知人物身份识别。[官方用法](https://github.com/m-bain/whisperX#python-usage-)、[导出器](https://github.com/m-bain/whisperX/blob/main/whisperx/utils.py)。
- **工作流与布局建议：**顶部多说话人泳道与波形，中部逐字稿，右侧说话人合并/重命名及低置信片段。导入 → 转写和对齐 → 按说话人回听 → 修正串话/重叠 → 导出带时间戳的访谈稿与字幕。和 faster-whisper 可共用素材格式，但应按是否需要对齐/分离选择后端。
- **运行条件：**Python `>=3.10,<3.14`；当前 GPU 安装说明使用 CUDA 12.8，也有 CPU INT8 路径。转写、对齐和分离会加载不同模型，应顺序卸载或限定并发；README 的 large-v2 “<8 GB GPU”并非任意组合的容量保证。[依赖](https://github.com/m-bain/whisperX/blob/main/pyproject.toml)、[安装及显存建议](https://github.com/m-bain/whisperX#setup-)。
- **代码许可：**当前为 [BSD-2-Clause](https://github.com/m-bain/whisperX/blob/main/LICENSE)。**模型许可：**ASR 可选上面的 Systran large-v3（模型卡 MIT）；中文默认对齐指向 [jonatasgrosman/wav2vec2-large-xlsr-53-chinese-zh-cn](https://huggingface.co/jonatasgrosman/wav2vec2-large-xlsr-53-chinese-zh-cn)（Apache-2.0）；当前分离模型 [pyannote/speaker-diarization-community-1](https://huggingface.co/pyannote/speaker-diarization-community-1) 为 CC-BY-4.0，获取需接受访问条件和使用 HF token。其他语种会选不同对齐模型，许可须逐个检查。[默认模型映射](https://github.com/m-bain/whisperX/blob/main/whisperx/alignment.py)。
- **判断：B，难度中高，6–10 人日。**多人素材需求明确时才优先，首版限制语种和模型组合；把字词漏对齐、多人重叠和说话人错误保留为人工审校状态。

## 5. FunASR：中文录音整理与富信息审听台

- **上游与定位：**[modelscope/FunASR](https://github.com/modelscope/FunASR)。面向中文录音、方言/多语言素材和带热词的行业语音；选择 SenseVoice-Small、Paraformer 等具体模型后再定义能力，不能把整个模型家族的功能相加。
- **上游能力与接口：**Python `AutoModel.generate()`；仓库同时存在示例 OpenAI 兼容服务和打包的 `funasr-server`，都可提供 `/v1/audio/transcriptions`，但默认模型、参数、时间戳和说话人字段并不相同。示例服务输出 `verbose_json` 不会自动开启时间戳，`segments` 可为空；HTTP 示例还会去除情感/事件标签。需要这些标签应从 Python SDK 取原始结果。[HTTP 合约](https://github.com/modelscope/FunASR/blob/main/examples/openai_api/README_zh.md)、[模型选择](https://github.com/modelscope/FunASR/blob/main/docs/model_selection_zh.md)。
- **工作流与布局建议：**左侧录音批次，中央原文与人工修订，底部可回听时间轴，右侧热词/语种/事件标签。第一版限定“中文转写与术语修订”或“SenseVoice 富文本审听”之一；情绪标签显示为模型猜测并可删除，不作为人员评价。
- **运行条件：**官方 HTTP 快速开始使用 Python 3.11，CPU 可先用 SenseVoice；GPU 需匹配 CUDA/PyTorch，Docker GPU 模式还需 NVIDIA Container Toolkit。WebSocket streaming runtime 是另一条部署路径，普通文件 HTTP 接口不等于实时字幕。示例服务没有内置鉴权/上传大小限制，应在同源适配层落实实际接入边界。[部署说明](https://github.com/modelscope/FunASR/blob/main/examples/openai_api/README_zh.md)。
- **代码许可：**当前 [MIT](https://github.com/modelscope/FunASR/blob/main/LICENSE)。**模型许可：**[SenseVoiceSmall 模型卡](https://huggingface.co/FunAudioLLM/SenseVoiceSmall) 标为 `model-license`，直接指向 [FunASR MODEL_LICENSE v1.1](https://github.com/modelscope/FunASR/blob/main/MODEL_LICENSE)，含署名、自定义行为及修订条款；不是 MIT/Apache-2.0。Paraformer、VAD、标点、CAM++ 或 Nano 权重须按选定组合另核，不以 SDK 的 MIT 代替。
- **判断：B，难度中高，6–10 人日。**中文和领域词汇有吸引力，但应先固定一个服务实现、一套模型和一个响应契约；模型许可及真实中文准确率确认后再升为 A。

## 6. ComfyUI：可复现的视觉素材生产台

- **上游与定位：**[Comfy-Org/ComfyUI](https://github.com/Comfy-Org/ComfyUI)；旧 `comfyanonymous/ComfyUI` 链接重定向至此。适合批量产品图、风格变体和固定生成配方，后续可扩展视频工作流。
- **上游能力与接口：**官方示例提交 API 格式 graph 到 `POST /prompt`，监听 `/ws`，读取 `/history/{prompt_id}`，通过 `/view` 获取产物；示例明确演示 `SaveImage` 节点。API 图和可视化编辑器保存的 workflow JSON 不是同一份可直接互换的执行载荷。[官方 WebSocket 示例](https://github.com/Comfy-Org/ComfyUI/blob/master/script_examples/websockets_api_example.py)、[OpenAPI](https://github.com/Comfy-Org/ComfyUI/blob/master/openapi.yaml)。
- **工作流与布局建议：**以中央素材对比墙为主，左侧已批准配方，右侧少量业务参数，底部任务队列。选配方 → 上传参考图/提示 → 生成多个种子 → 并排挑选 → 保存参数和版本 → 导出图像与运行清单。第一版使用固定、已审查的节点图，避免先搬运完整节点编辑器。
- **运行条件：**Python ≥3.10 与 PyTorch，权重、custom nodes 和 GPU 驱动位于独立服务。上游支持多种 GPU/CPU 路线，但显存和磁盘由选用模型、分辨率、量化和并发共同决定；不能把某个低显存例子套到视频。Docker 只是可选部署封装，不是模板能力。[项目说明](https://github.com/Comfy-Org/ComfyUI)、[Python 要求](https://github.com/Comfy-Org/ComfyUI/blob/master/pyproject.toml)。
- **代码许可：**主后端 [GPL-3.0](https://github.com/Comfy-Org/ComfyUI/blob/master/LICENSE)，复制/修改/分发其代码需单独处理相应义务；独立 API 接入并不免除实际分发内容的许可核查。**模型许可：**可选 [FLUX.1-schnell](https://huggingface.co/black-forest-labs/FLUX.1-schnell) 为 Apache-2.0，[SDXL base 1.0](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0) 为 CreativeML Open RAIL++-M；模型名相近不代表许可相同，LoRA、ControlNet、自定义节点、编码器和 VAE 另列清单。
- **判断：B，难度高，7–12 人日。**有现成 GPU 服务与固定配方时可提前；需要处理长任务、取消、断线恢复和模型缺失。推荐先图像后视频。

## 7. InvokeAI：画布局部重绘与创意审稿台

- **上游与定位：**[invoke-ai/InvokeAI](https://github.com/invoke-ai/InvokeAI)。已有 Unified Canvas、inpainting/outpainting、画笔、工作流、图库/board；适合在既有图片上持续修订，与 ComfyUI 的配方批处理有所区别。[功能说明](https://github.com/invoke-ai/InvokeAI#features)。
- **上游能力与接口：**保存的 workflow 不能直接执行；需把 executable graph 提交到 `POST /api/v1/queue/default/enqueue_batch`，轮询 `/api/v1/queue/default/i/{item_id}`，从结果取 `image_name` 后用 `/api/v1/images/i/{image_name}/full` 下载图像。适合先接固定重绘图，不应把“可列出 workflow”写成“已能运行 workflow”。[官方执行 API](https://github.com/invoke-ai/InvokeAI/blob/main/docs/src/content/docs/development/Guides/workflow-api.mdx)。
- **工作流与布局建议：**中央大画布与蒙版，左侧项目图库/图层，右侧局部提示和变体，底部前后版本。导入 → 标记局部 → 生成 → 对比 → 接受或撤销 → 保存版本与蒙版 → 导出图像。素材资产和修订关系由工作台保持；首版不复制完整上游画布系统。
- **运行条件：**当前要求 Python 3.12（不支持 3.13）；官方 SDXL 指引为 8 GB VRAM/16 GB RAM，Apple Silicon 建议 16 GB+ 统一内存。CPU 路线存在但本地生成慢。更大模型需求单列，CUDA/驱动版本应随固定发行版而非历史安装教程确定。[硬件与 Python 要求](https://github.com/invoke-ai/InvokeAI/blob/main/docs/src/content/docs/start-here/system-requirements.mdx)。
- **代码许可：**主项目 [Apache-2.0](https://github.com/invoke-ai/InvokeAI/blob/main/LICENSE)，仓库另含 HiDiffusion、PiD、SD/SDXL 等许可文件，不能给所有附带内容统一贴 Apache 标签。**模型许可：**若首版用 SDXL base 1.0，按 [Open RAIL++-M 模型卡](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0)；替换为其他 checkpoint 时重查，不能把 Invoke 主代码许可当权重授权。
- **判断：B，难度高，8–14 人日。**已有 GPU 基础设施且用户以“改图”为主时优先；仅需一次生成时先用 ComfyUI 固定配方更易控制范围。

## 8. Wan2.2：商品与分镜短片生成台

- **上游与定位：**[Wan-Video/Wan2.2](https://github.com/Wan-Video/Wan2.2)。优先限定 `TI2V-5B` 文生/图生短视频，供电商短片和创意分镜预览；它不是视频剪辑器或完整成片工具。
- **上游能力与接口：**官方 `generate.py --task ti2v-5B` 支持提示词及参考图，内部调用 `wan.WanTI2V`，结果保存 MP4。没有把官方推理脚本说成现成 REST 服务；需自己的异步 worker，或复用已支持 Wan2.2 的 ComfyUI 服务。片段拼接、字幕、配音是后续媒体流水线。[官方推理说明](https://github.com/Wan-Video/Wan2.2#run-text-image-to-video-generation)、[产物源码](https://github.com/Wan-Video/Wan2.2/blob/main/generate.py)。
- **工作流与布局建议：**左侧分镜卡，中间单镜头播放器，右侧参考图、提示和运动要求，底部多个生成版本。导入产品图 → 写镜头 → 单镜头生成 → 比较选片 → 导出 MP4 与镜头清单。第一版不承诺跨镜头角色一致性或长视频。
- **运行条件：**Python `>=3.10,<4.0`、PyTorch ≥2.4、FlashAttention、imageio-ffmpeg 等；官方 TI2V-5B 的 720P/24fps 示例使用卸载、dtype 转换和 T5 CPU 参数，要求至少 **24 GB VRAM**（如 4090）；文中 720P 尺寸为 1280×704 或 704×1280。此要求对应官方脚本路线，不能与 ComfyUI 量化/卸载路径的数字混用。[模型卡硬件说明](https://huggingface.co/Wan-AI/Wan2.2-TI2V-5B)、[依赖](https://github.com/Wan-Video/Wan2.2/blob/main/pyproject.toml)。
- **代码许可：**[Apache-2.0](https://github.com/Wan-Video/Wan2.2/blob/main/LICENSE.txt)。**模型许可：**指定的 [Wan-AI/Wan2.2-TI2V-5B](https://huggingface.co/Wan-AI/Wan2.2-TI2V-5B) 同为 Apache-2.0；社区量化、蒸馏、Animate/S2V 和其他外加模型不能自动继承本次核查结论。
- **判断：B，难度高，8–14 人日。**GPU 成本、任务等待和失败重试是主要门槛；只有明确需要视频生成且具备后端时进入首批。

## 9. IOPaint：图片修补台（归档项目，保留参考）

- **上游与定位：**[Sanster/IOPaint](https://github.com/Sanster/IOPaint)。LaMa 擦除、diffusion 局部重绘/扩图与分割/超分插件，适合商品图清理。仓库已经归档，不作为默认新增长期依赖。
- **上游能力与接口：**`POST /api/v1/inpaint` 接收 base64 原图、蒙版及参数，输出图像字节；还有模型切换、蒙版处理和保存接口。输入蒙版必须与原图尺寸一致。可以保留原图、蒙版、结果和参数；首版只开放一个明确模型。[API 源码](https://github.com/Sanster/IOPaint/blob/main/iopaint/api.py)、[请求结构](https://github.com/Sanster/IOPaint/blob/main/iopaint/schema.py)。
- **工作流与布局建议：**中央原图/结果滑杆对比，左侧批次素材，右侧蒙版笔刷和修补历史。导入 → 涂抹目标 → 修补 → 比较 → 局部重做 → 导出 PNG/JPEG；新增版本与批次管理，不照搬网站首页。
- **运行条件：**独立 Python/PyTorch 服务，官方 quickstart 支持 LaMa CPU，另支持 CUDA 和 Apple Silicon。setup.py 虽写 Python ≥3.7，但归档依赖的实际兼容组合需锁定，不能据此承诺最新 Python 可装。[README](https://github.com/Sanster/IOPaint#quick-start)、[包声明](https://github.com/Sanster/IOPaint/blob/main/setup.py)。
- **代码许可：**[Apache-2.0](https://github.com/Sanster/IOPaint/blob/main/LICENSE)。**模型许可未完整闭环：**默认 LaMa 实际从 [Sanster/models 的 big-lama.pt](https://github.com/Sanster/IOPaint/blob/main/iopaint/model/lama.py) 下载，原始 [advimman/lama](https://github.com/advimman/lama/blob/main/LICENSE) 仓库是 Apache-2.0；本次未确认这个转换权重资产自身的独立许可/来源链，不能据代码许可直接批准打包分发。其余 diffusion 模型和插件各自核查。
- **判断：C，难度中，历史参考或已有部署适配约 4–7 人日。**归档和权重许可来源链使它不适合作首批；可借鉴蒙版业务流程，再选择维护中的后端。

## 10. F5-TTS：参考音色与多角色配音实验台

- **上游与定位：**[SWivid/F5-TTS](https://github.com/SWivid/F5-TTS)。输入参考音频/文本和目标文本，做参考音色合成；有多风格/多说话人 Gradio 示例，适合受控的配音实验与研究。
- **上游能力与接口：**Python `F5TTS.infer(ref_file, ref_text, gen_text, ...)` 返回音频、采样率和谱图，并可写 WAV；有 CLI、Gradio 和 Triton/TensorRT-LLM 运行方案。主 Python API 不等于 OpenAI TTS HTTP API，需自己的任务封装。[API 源码](https://github.com/SWivid/F5-TTS/blob/main/src/f5_tts/api.py)、[官方运行路径](https://github.com/SWivid/F5-TTS#inference)。
- **工作流与布局建议：**左侧已获授权的参考音色素材，中部角色脚本/段落，右侧参考文本与合成参数，底部试听时间轴。导入参考音 → 核对转录 → 分配角色 → 分段生成 → 对比重做 → 导出 WAV。声音来源和使用范围随项目记录。
- **运行条件：**Python ≥3.10、PyTorch/torchaudio、FFmpeg；README 分别列 NVIDIA/AMD/Intel/Apple Silicon 安装路径，Docker 示例使用 GPU。L20 上的延迟基准不能换算成消费设备承诺；本次未找到所有路径通用的显存最低值。[安装及基准](https://github.com/SWivid/F5-TTS#installation)。
- **代码许可：**[MIT](https://github.com/SWivid/F5-TTS/blob/main/LICENSE)。**模型许可：**官方 [SWivid/F5-TTS 权重](https://huggingface.co/SWivid/F5-TTS) 是 **CC-BY-NC-4.0**，包括模型卡列出的 F5TTS_v1_Base；不能作为默认商业配音后端。代码 MIT 不会消除权重非商业限制。替代训练权重、Vocos/BigVGAN 声码器及自动参考转录模型还需独立核查。
- **判断：C，难度中高，实验版约 6–10 人日。**只在非商业研究范围或取得另行授权后考虑；当前商业候选优先 Kokoro。

## 维护证据快照

下表来自 2026-10-27 读取的 GitHub Repository API，记录 `archived` 和 `pushed_at`（UTC）。推送时间是维护信号，不证明最新发行包质量、依赖可安装或模型效果；没有用 star 数代替维护判断。

| 上游 | 归档 | 最后推送 UTC | 对选型的影响 |
|---|---|---|---|
| [faster-whisper](https://api.github.com/repos/SYSTRAN/faster-whisper) | 否 | 2026-10-25 07:17:13 | 活跃；固定发行版和 CTranslate2/CUDA 组合 |
| [Presenton](https://api.github.com/repos/presenton/presenton) | 否 | 2026-10-27 15:18:41 | 活跃；API、鉴权与桌面版边界需固定版本 |
| [Kokoro](https://api.github.com/repos/hexgrad/kokoro) | 否 | 2025-08-06 22:28:53 | 已较久未推送；首批选择需附带兼容性维护预算 |
| [WhisperX](https://api.github.com/repos/m-bain/whisperX) | 否 | 2026-10-22 14:53:44 | 活跃；多模型依赖和许可更复杂 |
| [FunASR](https://api.github.com/repos/modelscope/FunASR) | 否 | 2026-10-27 09:29:55 | 活跃；示例服务和打包服务合约需区分 |
| [ComfyUI](https://api.github.com/repos/Comfy-Org/ComfyUI) | 否 | 2026-10-27 16:50:12 | 活跃；节点、模型和执行图须一起固定 |
| [InvokeAI](https://api.github.com/repos/invoke-ai/InvokeAI) | 否 | 2026-10-27 05:04:43 | 活跃；Python/GPU 需求随发行版变化 |
| [Wan2.2](https://api.github.com/repos/Wan-Video/Wan2.2) | 否 | 2026-09-21 06:16:22 | 未归档；推理栈、模型权重和硬件先做专项探针 |
| [IOPaint](https://api.github.com/repos/Sanster/IOPaint) | **是** | 2025-04-29 02:13:17 | 降为历史参考/已有服务适配 |
| [F5-TTS](https://api.github.com/repos/SWivid/F5-TTS) | 否 | 2026-10-23 22:59:22 | 活跃，但官方权重非商业限制优先于活跃度 |

## 从调研进入实现时的最小验收

先只为首选三个各固定一个模型/服务版本，记录代码 license、权重 license、声音/字体等附加资产来源，以及设备和依赖版本。每个工作台至少完成一次真实输入→推理→编辑→恢复草稿→导出的闭环，再记录导出文件能被目标播放器/字幕软件/PowerPoint 打开。

长任务要验证服务不可达、模型缺失、取消、上传超限、浏览器刷新后恢复和任务失败后的可重试状态。字幕需要核对时间戳与静音；配音需要实际试听中文、多音字、数字和段落拼接；课件需要检查 PPTX 可编辑性、中文字体、图表/图片及 PDF 分页。以上是后续验收计划，本次均未执行。
