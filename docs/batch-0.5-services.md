# 0.5.0 服务与启动

源码包在Floatboat中导入后仍需为下表中列出的外部引擎安装依赖并启动服务。服务地址使用环境配置，不写入完整项目或截图。原生凭据仅在服务端配置。按每个项目README中的版本与启动命令操作。

| 工作台 | 运行条件 | 配置说明 |
| --- | --- | --- |
| Penpot | 无需独立服务 | [项目说明](../workbenches/44-penpot/README.md) |
| HyperFrames | 独立Node渲染服务，默认8782 | [项目说明](../workbenches/62-hyperframes/README.md) |
| Graphify | 独立Python服务，默认8781 | [项目说明](../workbenches/63-graphify/README.md) |
| PageIndex | 独立Python解析服务8784；问答使用Floatboat Host | [项目说明](../workbenches/64-pageindex/README.md) |
| DeepTutor | 独立Python服务8786；出题使用Floatboat Host | [项目说明](../workbenches/65-deeptutor/README.md) |
| Agent-Reach | 独立Python采集服务8783；登录渠道只做结果导入 | [项目说明](../workbenches/66-agent-reach/README.md) |
| OpenMontage | 独立Python/FFmpeg制作服务，默认8797 | [项目说明](../workbenches/67-openmontage/README.md) |
| DeerFlow | 需配置官方DeerFlow服务与模型；默认请求gemini-3.8-flash | [项目说明](../workbenches/68-deerflow/README.md) |
| MiroFish | 需配置官方MiroFish服务，预先准备模拟、模型和Zep | [项目说明](../workbenches/69-mirofish/README.md) |
| GEOInflow | 无需独立服务或模型 | [项目说明](../workbenches/70-geoinflow/README.md) |
| OpenPencil | 现有Node核心无需独立服务；浏览器WASM升级待客户端与模板就绪 | [项目说明](../workbenches/71-openpencil/README.md) |
| FigCraft | 独立Node桥接服务8796及官方FigCraft CLI | [项目说明](../workbenches/72-figcraft/README.md) |

本批便携交付ZIP包含12个`.fbworkbench`，以及support目录中的已跟踪服务源码、锁文件、项目说明和上游许可。它不打包Python虚拟环境、CLI安装目录、node_modules、模型文件或运行数据；缺少依赖时先依项目说明安装。

DeerFlow和MiroFish直接连接官方独立部署，本批不另外提供完整上游部署。MiroFish须先在上游准备图谱、角色与模拟；DeerFlow须配置可用模型，默认名为gemini-3.8-flash。两项真实模型运行尚未验证。

OpenPencil CanvasKit与FigCraft浏览器WASM路线不在当前验收中。用户确认客户端和模板可测试后，再按同一持久化与导出标准升级。
