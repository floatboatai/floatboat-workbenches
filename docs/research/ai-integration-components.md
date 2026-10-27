# AI 前端组件与推理基础库

核查日期：2026-10-27。这三项是可复用组件或引擎，不作为三个已经完整可用的业务工作台。下面的产品应用、Host adapter、持久化和界面都是后续工程建议；本轮未安装、构建或运行集成。

## CopilotKit：把 AI 操作接进业务画布

**适合的用途。** 为现有表格、演示稿或资料处理工作台增加带上下文的操作：用户选择对象 → 提出修改要求 → 显示结构化修改预览 → 确认后应用。主界面仍然是对应产品的画布、表格或文稿。CopilotKit 是应用与 Agent 的交互层，不是完整的文档编辑器或自动持久化引擎。

**已核实能力。** `useAgent` 可取得 AG-UI agent、订阅状态及消息；headless 入口可以不加载现成聊天渲染栈。AG-UI 定义客户端与 agent 间的事件协议，运行时负责代理请求。React 核心当前源码包为 1.81.0，peer 支持 React 18/19；TypeScript runtime 声明 Node ≥20。这是版本声明有交集，尚不等于模板打包成功。[Hook 文档](https://docs.copilotkit.ai/reference/hooks/useAgent)、[React 包](https://github.com/CopilotKit/CopilotKit/blob/main/packages/react-core/package.json)、[runtime 包](https://github.com/CopilotKit/CopilotKit/blob/main/packages/runtime/package.json)。

**接法与依赖。** 优先验证 React headless + TypeScript runtime 的同源 SSE 路线。官方文档明确 TypeScript runtime 可不接 Intelligence；Python/Go/Ruby/C# runtime 则需要云端或自托管 Intelligence。云端线程、记忆和分析能力不能当成本地库自动提供的能力。工作台可保留自身 SQLite 数据，另写 Host LLM/Agent 到 AG-UI 的事件和取消适配；Host 并非现成的 AG-UI/OpenAI endpoint。无 GPU 必需项，实际模型仍需 Host 或已配置服务。[Intelligence 的边界](https://docs.copilotkit.ai/intelligence/quickstart)、[可不接 Intelligence 的 SSE 路线](https://docs.copilotkit.ai/deepagents/quickstart)。

**许可与维护。** 已核根 LICENSE、React/runtime 包声明为 MIT；Intelligence 服务权益另计，不从 MIT 推导可自由使用全部托管能力。GitHub 未归档，最近 push 日期为 2026-10-27 UTC。[LICENSE](https://github.com/CopilotKit/CopilotKit/blob/main/LICENSE)、[元数据](https://api.github.com/repos/CopilotKit/CopilotKit)。

**建议：P2 / 中。** 等一个明确业务流程需要 AI 修改预览时引入；先验证单次真实 Host 调用和单个结构化操作，避免给所有工作台附加相同聊天侧栏。

## assistant-ui：复用交互部件，自建持久化和任务界面

**适合的用途。** 需要对话分支、消息部件、工具结果和中断状态时复用 React primitives。例如研究任务的追问区、写作批注区，而业务资料、结果版本和证据仍由独立界面承载。它是 UI 库，不含知识库、模型服务或产品级自动保存。

**已核实接口。** `LocalRuntime` 通过 `ChatModelAdapter.run` 或 async generator 接自定义后端；`ExternalStoreRuntime` 由应用提供消息和回调。后者适合已有 SQLite/Host 会话为真实状态来源的工作台。官方支持 history、thread list、import/export 和恢复接口，但应用必须实现对应 adapter；运行中的请求能否恢复取决于后端是否保留可用检查点，不能把重新发送称为恢复。[Custom runtime](https://www.assistant-ui.com/docs/runtimes/custom/overview)、[LocalRuntime](https://www.assistant-ui.com/docs/runtimes/custom/local-runtime)、[ExternalStoreRuntime](https://www.assistant-ui.com/docs/runtimes/custom/external-store)。

**接法与依赖。** 当前 `@assistant-ui/react` 源码清单为 0.15.31、MIT、peer React 18/19，包自身未声明 Node engine；但 monorepo 根开发环境要求 Node ≥24.11。因此应验证已发布组件包与固定模板的兼容性，不能复制整仓构建流程到 Node 22。自定义后端路线不要求使用 Assistant Cloud；浏览器请求经同源 Node 路由，再转接真正的 Host 能力。保存草稿、分支选择、附件和失败状态仍要实现，内存中的消息状态不等于落盘。[React 包](https://github.com/assistant-ui/assistant-ui/blob/main/packages/react/package.json)、[整仓构建环境](https://github.com/assistant-ui/assistant-ui/blob/main/package.json)、[线程适配](https://www.assistant-ui.com/docs/runtimes/concepts/threads)。

**许可与维护。** 已核根 LICENSE 和 React 包为 MIT；云服务使用条款另计。GitHub 未归档，最近 push 日期为 2026-10-27 UTC。[LICENSE](https://github.com/assistant-ui/assistant-ui/blob/main/LICENSE)、[元数据](https://api.github.com/repos/assistant-ui/assistant-ui)。

**建议：P2 / 低–中。** 作为具体产品的局部 UI 基础。先选择需要的 primitives，不以一个聊天页面冒充新的行业工作台。

## Transformers.js：本地模型工具的候选引擎

**适合的用途。** 文本分类与实体标注、图片分类、语音转录等限定任务。工作台应围绕待处理资料、模型选择、批次进度、结果复核和导出，而不是只展示模型聊天。模型输出格式、语言覆盖和许可必须逐个核对。

**已核实能力。** 官方提供 `pipeline`，覆盖文本、图像、音频等任务；默认浏览器推理走 ONNX Runtime/WASM，也有 WebGPU 路径。v4 官方发布说明增加了跨浏览器与服务端 JS 环境的 WebGPU runtime。当前源码包为 4.3.1，包含 `onnxruntime-node`、`onnxruntime-web`、`sharp`；因此不能因名称里有 JS 就认为依赖全是纯 JS。[官方文档](https://huggingface.co/docs/transformers.js/en/index)、[v4 说明](https://huggingface.co/blog/transformersjs-v4)、[包清单](https://github.com/huggingface/transformers.js/blob/main/packages/transformers/package.json)。

**当前关卡。** 模板浏览器 CSP 已实测阻止 WebAssembly；同源托管模型和 WASM 文件只能解决下载来源，不能解除编译限制。WebGPU 路径也不能未经探测就声称绕过了 ONNX/WASM 初始化。Node 默认依赖路径含原生模块，同样不符合当前应用包的直接接入假设。建议作为独立推理服务的候选，或等固定 runtime 明确支持后再做专项验证；本轮不修改 CSP、不安装模型。[模板实测](template-csp-probe.json)、[模型和 WASM 路径配置](https://huggingface.co/docs/transformers.js/en/custom_usage)。

**许可与维护。** 引擎代码 Apache-2.0；各个模型权重、tokenizer 和数据集的许可不随引擎自动变成 Apache-2.0。GitHub 未归档，最近 push 日期为 2026-10-27 UTC。[LICENSE](https://github.com/huggingface/transformers.js/blob/main/LICENSE)、[元数据](https://api.github.com/repos/huggingface/transformers.js)。

**建议：暂缓内嵌 / 高。** 先保留本地推理方向；首轮业务工作台优先使用接口更明确的外部服务。以上是源码和文档层面的适配判断，尚无真实模型、浏览器运行或打包验收。
