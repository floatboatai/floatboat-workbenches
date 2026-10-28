# 0.6.0 · 原生工具工作台

2026-10-28。本批6项完成本地构建、71项应用测试、真实Chrome任务与恢复验收，以及源码包CRC、源码/资源对应和许可证检查。实际导出的源码包在Linux中解压后再次通过71项测试，包含资源路径重定位后的React Email来源校验。客户端导入仍未实测。

仓库累计50/72项完成本地功能验收。开发在4个隔离worktree中进行，主代理与3个子代理并行；各项目独立提交后合并复核。

## 已完成流程

| 工作台 | 核心流程 | 实际原生集成 |
| --- | --- | --- |
| [Konva](../workbenches/28-konva/README.md) | 原生Konva画板、对象变换、图片与PNG/完整工程 | Konva 10.9.0，原生Stage/Transformer与PNG导出 |
| [LogicFlow](../workbenches/29-logicflow/README.md) | 原生流程图编辑、规则检查、路径审阅与原生数据导出 | LogicFlow core2.2.5/extension2.3.1，原生图纸与Snapshot PNG |
| [SimpleMindMap](../workbenches/31-simplemindmap/README.md) | 原生可编辑脑图、结构/主题与导出 | simple-mind-map0.14.0-fix.3，原生节点命令/结构/主题/SVG |
| [wavesurfer.js](../workbenches/33-wavesurfer-js/README.md) | 真实音频与波形、区间编辑/循环回听、审阅及工程导出 | WaveSurfer7.12.12及Regions/Timeline，真实音频解码与回听 |
| [React Email](../workbenches/42-react-email/README.md) | 官方邮件组件编排与渲染、HTML/纯文本/项目导出 | React Email6.11.4官方现役纯组件固定源码 + 官方render2.1.1 |
| [Bruno](../workbenches/45-bruno/README.md) | 原生Bru请求、显式HTTP执行、结果检查与导出 | @usebruno/lang0.41.0原生Bru解析/生成与真实HTTP |

## 保存与导出

所有编辑器使用完整工作副本与独立正式数据；未完成数字、源文件、JSON和模板变量保留。恢复稿实际下载后可回导为新副本，导入不覆盖原项目，也不会执行历史HTTP请求。验证覆盖延迟回执期间继续输入、服务已写入但回执丢失、两窗口冲突、刷新、离线新稿、项目切换锁和375px键盘操作。

Konva限制新增至200对象，同时允许旧超限稿保留以便修复。图片工程统一16MiB UTF-8往返预算：13张原图的12.5MB工程已实际回导，超过预算明确拒绝，不少带原图。PNG导出固定点击时的场景与原件，期间编辑不会混入导出。

LogicFlow标题与原始图纸输入在应用前检查结构上限；中文大稿按UTF-8区分正式与恢复容量。wavesurfer.js的1.08MB草稿经真实HTTP/SQLite确认后仍完整回读，引用原件恢复时按实际解码时长校验，越界选段和笔记继续作为草稿保留。Bruno补验约1.86MB已确认草稿的完整恢复。

Bruno在外部HTTP前写持久操作记录；未知回执不会自动重发，提前取消也有持久记录。响应正文最多64KiB，重定向不自动跟随；网络异常不伪装为远端没有执行。

## 范围与运行条件

- **Konva**：200个正式对象；每图750KB、1600万像素；完整工程16MiB；不包含Polotno、撤销或滤镜。
- **LogicFlow**：结构与路径用于审阅，不执行业务；内置节点/边，最多30条路径。
- **SimpleMindMap**：纯文本树；拒绝富文本、图像、链接、插件与上游完整配置，原始输入保留。
- **wavesurfer.js**：单原件32MiB/10分钟；500选段；无转写、剪切、降噪或音频重编码。
- **React Email**：浏览器校样和HTML/纯文本导出；未发送邮件，不保证所有邮件客户端像素一致。
- **Bruno**：20个源文件、4个响应快照、10秒/64KiB；不执行脚本、测试、环境或鉴权继承，不自动重发未知请求。

本批不需要独立模型、GPU或外部引擎服务。Bruno需要用户显式选择可访问的HTTP端点，实际执行使用本地测试服务核验；没有向真实业务系统创建订单。React Email只制作与导出邮件，不发送邮件；现役官方纯组件固定源码及MIT归属随包保存，避免引入统一开发包的构建依赖。

完整图片/音频工程包含原件；恢复稿只保存工作内容与资源引用，跨实例需重附匹配原件或使用完整工程。完整自动保存请求上限1.95MB，超出请求预算须先导出并拆分；浏览器本机恢复限定同一来源。极快切换或未确认缓存时保留保护确认。

沿用固定官方模板，未修改SDK、工具链或CSP。本批未使用Host模型，原有Gemini3.8设置不变；WASM画布升级等待用户就绪。

## 获取与验证

每个项目README提供启动方式、操作与限制。官方CI根据catalog选择50项，生成源码包、真实介绍图和presentation.json；当前线上结果见[Actions](https://github.com/floatboatai/floatboat-workbenches/actions)。本地CI组包和17项仓库工具测试另行通过。上传由既有官方账号工作流处理，上传成功不等于审核或公开上架。

源码包不含预览数据、凭据、node_modules或运行目录。原创封装MIT文本及上游各自许可随包保留。最终哈希与逐项证据见[交付清单](release-0.6.0.json)，真实截图见[截图说明](screenshots/README.md)。构建中的较大模块提示来自共享自动保存和较完整的单页工具界面，类型和构建门禁均通过。
