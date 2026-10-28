# 0.8.1 · 按工作任务重排页面

用户反馈揭示了此前验收的缺口：颜色和内容区有所变化，页头仍反复使用项目选择、新建、导入的同一组合。本轮暂停新增，重做三个代表性产品的文件路径与空间结构，并修正后续生成、同步和设计审查规则。

全仓56项源码扫描中，28项在页头组合项目选择和新建，40项使用共享ProjectPicker。本轮完成3项结构审查；其余26项待结构整改、27项待进一步视觉与任务审查。功能验收仍为56/78，不能将它等同于全仓结构通过。完整清单见[结构审计](layout-audit-2026-10-28.md)。

## 实际变化

| 工作台 | 主任务与空间 | 文件生命周期 |
| --- | --- | --- |
| Oasis | 居中连续纸张，格式工具紧邻纸面；页导航、笔记与文档信息按需打开 | 从文稿菜单新建、打开或导入，正文直接自动保存；导出与原件/恢复操作保留 |
| CircuitJS | 原生电路和Scope主导，左侧元件架，底部运行、时基、探针和数值仪表 | 实验簿选择样例、最近实验或导入；实验笔记按需打开，文件管理离开首屏主操作区 |
| glTF | 全幅模型空间、底部材质带、按需上下文检查器 | 从空态或资产库打开GLB，库中保留工作稿；修订和交付紧邻所检查的对象 |

所有截图来自实际运行的界面。左侧固定为0.8.0基线，右侧为本轮真实示例；原图未经过界面合成。

### Oasis 文稿室

| 改版前 · 0.8.0 | 改版后 · 0.8.1 |
| --- | --- |
| <img src="https://raw.githubusercontent.com/floatboatai/floatboat-workbenches/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/docs/screenshots/oasis-editor.png" alt="Oasis 文稿室改版前" width="430"> | <img src="screenshots/oasis-editor.png" alt="Oasis 文稿室改版后" width="430"> |

### CircuitJS 电路实验

| 改版前 · 0.8.0 | 改版后 · 0.8.1 |
| --- | --- |
| <img src="https://raw.githubusercontent.com/floatboatai/floatboat-workbenches/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/docs/screenshots/circuitjs.png" alt="CircuitJS 电路实验改版前" width="430"> | <img src="screenshots/circuitjs.png" alt="CircuitJS 电路实验改版后" width="430"> |

### glTF 资产检查

| 改版前 · 0.8.0 | 改版后 · 0.8.1 |
| --- | --- |
| <img src="https://raw.githubusercontent.com/floatboatai/floatboat-workbenches/b2c90796c4bccb61b38d75200a7a00b64f7a12c8/docs/screenshots/gltf-transform.png" alt="glTF 资产检查改版前" width="430"> | <img src="screenshots/gltf-transform.png" alt="glTF 资产检查改版后" width="430"> |

## 验证与生成约束

三项应用检查与26项既有核心测试通过；真实Chrome验证新文件入口、创建/打开/恢复、未失焦自动保存、延迟响应、桌面与375px、键盘焦点和原生视图稳定。详细范围见各项目ACCEPTANCE.md。

打开菜单和检查面板保持原生编辑器/画布实例，切换文档时保护旧稿。后台自动保存继续允许编辑；文件、原件和恢复能力没有为了简化首屏而删除。应用身份、数据库与持久化键沿用原版；客户端导入和升级环境尚未实测。

20项仓库工具测试通过。新增回归验证连续两次自动保存升级仍保留自定义workspace.tsx、App.tsx、样式和已应用迁移。新蓝图不再预置ProjectPicker；同步脚本保留产品导航，初始化设计说明先记录工作对象和文件生命周期。

结构审查独立记录在catalog.verification.structuralLayout中。未命中静态规则的项目只记pending，功能通过不自动授予结构通过；DESIGN.md须提供实际主任务、布局对照和窄屏流程证据。

## 交付

三个0.8.1工作台包已校验ZIP CRC、transfer逐条哈希、全部应用源码与声明资源。默认不含用户数据、依赖安装目录或凭据。源包及截图哈希见[交付清单](release-0.8.1.json)。本轮为界面与导航改版，0.8.0的原生文件探针和Linux执行记录作为历史证据单独保留，不冒充新包客户端导入结果。

模板、SDK和CSP保持固定。CircuitJS整体GPL-2.0-or-later，完整对应源码仍随包交付；当前商店的MIT限制保持，官方上传只暂存资料。Oasis与glTF原创集成仍采用MIT，第三方声明保留。

工作台数量维持56/78；本轮结构完成范围为这三项，其余项目按审计清单继续整改。GitHub构建和上传状态见[Actions](https://github.com/floatboatai/floatboat-workbenches/actions)。
