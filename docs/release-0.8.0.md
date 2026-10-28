# 0.8.0 · 分页文档、电路与模型检查

2026-10-28。本批3项完成原生核心集成、26项应用测试、真实Chrome任务和自动保存验收；实际导出源码在无网络Linux环境中通过26项测试。仓库累计56/78项完成本地功能验收，仓库工具测试19项通过。

Floatboat客户端导入尚未实测。本页区分本地验收、导出源码复验、GitHub交付和官方上传；官方上传只暂存资料，不代表商店审核或公开上架。

## 工作台

| 项目 | 实际流程 | 原生来源 |
| --- | --- | --- |
| [oasis-editor](../workbenches/76-oasis-editor/README.md) | 分页DOCX编辑、原始文档保留、表格/图片校样、中文PDF与DOCX及完整工程导出 | celsowm/oasis-editor 0.0.195 · ad0bd38f7ec7258ee2fb7a9f23fa7815a3d04195 · MIT |
| [circuitjs](../workbenches/77-circuitjs/README.md) | 基础RLC电路编辑、原生求解与示波器、参数草稿、原生电路与读数导出 | pfalstad/circuitjs1 · e952e788a4135a693bfd4cee7883f9b3314e3e76 · GPL-2.0-or-later |
| [gltf-transform](../workbenches/78-gltf-transform/README.md) | 自包含GLB检查、节点与PBR材质修改、JSON元数据、保留蒙皮/动画/贴图的结果与工程导出 | @gltf-transform/core 4.5.1 · 895b70777fda68aa321358d17dab2105e8564d08；Three 0.185.0 · MIT |

Oasis Editor使用原生分页Canvas、DOCX读写与PDF导出。中文校样使用随包字体；DOCX字体名称经过规范，避免CSS字体列表在重复回导时叠加。完整OOXML部件以无损压缩保存，解压后限制8MB；原始DOCX独立保存。中文、多页、表格和图片的实际导出已回读，并用独立Office消费者核对。外部Office排版依赖其可用字体，原件保留不等于所有复杂Word特性均可编辑。

CircuitJS保留原生TypeScript编辑器、求解器和Scope。真实分压电路读数2.5V，RC在1ms的读数约3.155997V，与理论约3.160603V相差0.00461V。成功求解步进绑定当前电路；暂停编辑或重置立即使读数失效，不能将旧结果标记为新电路的有效导出。原生参数对话框的未完成输入也进入工作稿。

glTF Transform使用NodeIO检查并写回GLB，Three负责真实模型和贴图预览。修订只修改选定的节点、材质或元数据，原件和结果分开保存。独立复核带66个关节与动画的模型，141个accessor的实际数值字节及内嵌图片哈希均保持一致；不以空动画列表冒充动画保留。NodeIO对接近默认值的TRS使用有限精度归一，应用保全检查只在节点TRS使用1e-5容差，几何、蒙皮矩阵和动画浮点数据仍逐项精确比较。

## 自动保存和故障恢复

工作副本包含正式数据、未完成输入、视图和资源引用。验收覆盖未失焦输入、延迟保存期间继续编辑、写入成功但回执丢失后的幂等重试、冲突、离线新稿和恢复稿导入为独立副本。普通后台保存保持可编辑，切换文档隔离旧状态和迟到请求。

完整工程与只含资源引用的恢复工作稿按各项目说明区分。缺少原件或模型时需补齐匹配资源；导入新副本不覆盖原项目。恢复不会自动运行电路或播放动画。实际草稿容量、资源预算、边界与测试证据见各应用ACCEPTANCE.md。

## 支持范围

- **oasis-editor**：外部DOCX排版依赖字体和消费者；复杂OOXML能力按验收范围，不能保证Word像素级还原。
- **circuitjs**：首版限定基础电路类型；工程恢复保持暂停；GPL交付不等于当前MIT限定商店可上架。
- **gltf-transform**：普通无扩展GLB，1.4MB、50000顶点及贴图预算；压缩、Morph及未验证扩展明确拒绝。

固定模板3b55d46f7ae25e939ce3299073c37ed334d69c02；SDK、工具链和CSP未修改。本批不需要浏览器WASM，不调用Host模型，既有Gemini3.8设置保持。

## 源码、许可和交付

三个隔离worktree分别实现，再由主线程复核和集成。源码包通过ZIP CRC、transfer逐文件哈希、源码/声明资源对应和许可检查。默认源码交付不含用户数据、凭据、node_modules或本地运行目录。

Oasis和glTF原创集成采用MIT，原生库、字体及依赖保留各自声明。CircuitJS衍生工作台整体采用GPL-2.0-or-later，包含完整对应源码、固定上游快照、哈希和资源重定位后的重建说明。当前商店发布接口仍仅接受MIT；CircuitJS按GPL交付到仓库和本地包，不能声称已满足现有商店上架条件，也不改标MIT。

介绍文件允许包含完整许可与能力说明，CircuitJS的GPL及商店发布边界随presentation.json和上传请求保留；该文字不替代包内LICENSE，不绕过后端发布规则。

最终包哈希见[交付清单](release-0.8.0.json)，真实界面见[截图说明](screenshots/README.md)。解压交付ZIP后，在Floatboat「我的 → 工作台 → 导入工作台」选择各目录内的.fbworkbench；客户端导入尚未实测。

GitHub工作流将按catalog检查、测试和打包56项，全部通过后才执行官方账号上传。实际状态以[Actions](https://github.com/floatboatai/floatboat-workbenches/actions)为准，上传成功不等于公开上架。

浏览器服务器状态检查使用Node端await轮询或实际HTTP回执断言，避免当前测试环境中异步waitForFunction提前返回而造成假阳性。
