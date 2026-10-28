# 0.7.0 · 光学、单据与角色动画

2026-10-28。本批3项完成原生核心集成、34项应用测试、真实Chrome任务与保存恢复验收。实际导出的源码包在Linux中解压后再通过34项测试，包含重定位后的资源、字体和来源校验。仓库累计53/75项完成本地功能验收。

17项仓库工具测试亦通过。客户端导入尚未实测。以下结果区分本地功能、导出源码复验与GitHub发布；没有把浏览器启动或静态页面当作完整业务验收。

## 实际功能

| 工作台 | 本批流程 | 原生来源 |
| --- | --- | --- |
| [ray-optics](../workbenches/73-ray-optics/README.md) | 原生光路编辑、CPU模拟、探测器与PNG/场景/工程导出 | Ray Optics5.5.0 commitdaf76772原生Scene/Simulator/Editor |
| [invoice-builder](../workbenches/74-invoice-builder/README.md) | 原生计价与PDF模板、报价/发票、图片及工程恢复 | Invoice Builder commit2979d917原生财务与PDF组件，React PDF4.9.0 |
| [mesh2motion](../workbenches/75-mesh2motion/README.md) | 原生人形绑定、87动作预览、动画GLB与完整工程 | Mesh2Motion commiteef2de98原生权重管线，Three.js0.185.0 |

Ray Optics保留真实Scene、Simulator和Editor，完成基础光路编辑、镜面反射、透镜与探测器读数。嵌入布局的指针坐标作了限定适配；每次编辑或视口变化都取消旧计算分片并使结果失效，迟到结果不能把新场景标成已计算或启用PNG。PNG固定已完成计算的画面，场景JSON可回导。

Invoice Builder复用上游计价函数和PDF组件，工作台负责单据模型、持久化和操作空间。中文Regular/Bold字体随资源包交付；实际单页与三页PDF已逐页渲染查看，60条明细连续、页码和金额正确。界面中的内容预览与实际PDF校样分别提供；375px可在PDF容器内放大和滚动，页面本身不溢出。PDF请求冻结点击时的数据，更新或切换项目后忽略过期结果。

Mesh2Motion复用固定的原生权重计算、平滑和纠正模块。真实静态人形模型完成绑定与动作预览，导出GLB包含skin、JOINTS_0/WEIGHTS_0、嵌入贴图和动画。主线程另行检查7399顶点权重归一化、关节索引和19条变化的动画轨；浏览器验证与完整恢复记录见项目验收。贴图通过符合固定CSP的加载路径处理，不修改安全策略。

## 自动保存与资源

工作副本保存正式数据、未完成数值/文本、视图及资源引用，状态区分已保存、草稿、离线和冲突。验证覆盖输入未失焦时的自动写入、延迟回执期间继续输入、已写入但回执丢失后的幂等重试、双窗口冲突、离线新稿切走后恢复，以及导入创建新副本。

Ray实际下载并回导3,848,198字节的pending恢复包，保留其中已确认的1.92MB工作输入；Invoice另验实际1.9MB确认草稿回导。外层恢复文件允许包含current/pending封装，内层仍按共享请求预算严格校验，避免已确认草稿无法导回。

图片、模型和字体按各项目的数据或固定资源边界处理。完整工程与只含引用的恢复稿分别说明；跨实例缺少原件时要求重附匹配原件或导入完整工程。恢复不自动继续模拟、播放动画、寄送单据或记账。

## 支持范围

- **ray-optics**：version5、10种用户元件、100对象、10000条处理光线；不支持模块/背景/公式/WebGPU。
- **invoice-builder**：80条明细；每图150KiB/400万像素；支持4币种；原生JSON仅导出，工程/恢复稿可回导，不寄送或记账。
- **mesh2motion**：人形66关节；静态自包含GLB≤1MB/16000顶点，结果≤1.4MB，完整工程≤8MB；不支持外部纹理、压缩扩展、Morph、FBX或已绑定源模型。

沿用固定模板3b55d46f7ae25e939ce3299073c37ed334d69c02，未修改SDK、工具链或CSP。本批不调用Host模型，原有Gemini3.8设置保持；浏览器WASM不作为本批前提。未验证的特殊文件格式、模型压缩及额外执行能力不包含在上述范围中。

## 源码、许可与交付

开发使用三个隔离worktree，独立提交后由主线程合并。源包通过ZIP CRC、transfer逐文件哈希、源码/资源逐字节对应和许可检查；默认不含业务数据、凭据、node_modules或本地运行目录。

原创集成代码MIT；Ray原生源码Apache-2.0，Invoice原生源码MIT，Mesh代码MIT且其自有示例资产CC0，字体OFL和依赖各自许可均保留。固定上游提交、原始文件与适配差异在各应用的声明/来源清单中记录。

最终包与介绍图哈希见[交付清单](release-0.7.0.json)，截图见[截图说明](screenshots/README.md)。解压交付ZIP后，在Floatboat「我的 → 工作台 → 导入工作台」选择各目录内的.fbworkbench。

GitHub会按catalog检查、测试并打包53项，上传沿用既有官方账号工作流。当前运行结果见[Actions](https://github.com/floatboatai/floatboat-workbenches/actions)；上传成功不等于商店审核或公开上架。

浏览器验收的服务器状态使用Node端实际await轮询或HTTP回执断言。当前测试环境的async waitForFunction存在提前返回行为，Mesh验收脚本已修正后完成验证；Ray与Invoice的对应等待原本即为同步谓词或Node循环。
