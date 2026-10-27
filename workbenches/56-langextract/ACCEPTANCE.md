# LangExtract 0.4.0 验收

日期：2026-10-27。Node22.22.2、pnpm10.22.0、Python3.12.13、Chrome headless。上游 Python 固定 `langextract==1.7.1`，依赖快照见 `service/requirements.lock`。

## 已运行

| 检查 | 结果与范围 |
| --- | --- |
| `pnpm workbench:check` | manifest、依赖、TypeScript、构建通过；有3个大模块提示（evidence领域契约、页面组件、共享autosave），不是失败 |
| `pnpm test` | 13项通过：Unicode区间、多文档往返、未定位/畸形区间、原文变更、CSV安全转义、容量与标识、运行前校验、幂等任务、来源绑定、连接器边界、草稿恢复/冲突、终态竞态 |
| `python3 -m unittest discover -s service -v` | 7项通过：重复提交、重启中断、结果落盘、取消后不恢复、错误不泄露凭据、输入验证、实际HTTP鉴权与未配置状态 |
| 实际安装的 LangExtract 管线 | `verify_upstream.py` 使用真实 `lx.extract` + 显式 deterministic stub model；2条记录准确落在含emoji的Python字符区间，并经官方 JSONL 保存/加载往返。**不是实际模型推理或质量评测** |
| Node→Python连接器 | 实际 loopback HTTP：health、Bearer认证失败、未配置模型的503均按契约处理；没有调用模型 |
| Chrome主任务 | JSONL导入、选择记录、高亮、接受/修订/备注、筛选、CSV/JSONL/完整项目导出，均通过 |
| SQLite与浏览器恢复 | 自动保存后刷新恢复；源改动使旧区间失效；未应用的无效示例JSON恢复；导入创建独立项目并保留旧项目；预览进程重新构建后新来源页面仍由SQLite恢复 |
| 保存竞态 | 真服务器响应延迟时继续输入，后写保留；服务器已提交后丢失响应，重试同mutation不重复；另一窗口写入后冲突保护服务器版本并保留本机稿 |
| 视觉与可访问性 | 1440px、375px检查；窄屏资料/配置/任务无页面水平溢出；键盘focus可见、语义按钮/标签、reduced-motion；dark媒体下固定纸张配色仍清晰；标签页hash刷新恢复；无pageerror |
| 打包 | `artifacts/langextract-studio-0.4.0-verified.fbworkbench`，32个源文件；排除业务数据和凭据。Python服务需另行部署 |

截图为运行中的真实业务页面，普通手工示例资料经过编辑与保存，非模型生成结果。见[截图](../../docs/screenshots/langextract.png)。项目的所有新代码和设计为本次实现；未更改SDK、tooling、固定CSP或共享自动保存协议。

## 结果与限制

- 真实可用：资料/字段编辑、JSONL审校、来源区间、状态/修订、三种导出、自动保存、恢复与冲突。
- 服务适配已实现并通过契约/HTTP测试：Python `lx.extract` 包装、独立SQLite任务、Node同源连接器、原ID对账、取消结果接收、终态保护、源快照匹配。
- **真实模型提供方抽取未验证**：当前未配置模型凭据，也未下载模型。不能把示例、stub或服务health成功当作模型调用成功。连续中文可能无法被上游准确对齐，界面保留未定位项。
- Host 未连接；本版不调用Host LLM/Agent，无Host能力声明。Floatboat客户端导入未实测。
- 30k字符/文档、最多8文档/300记录每文档、整体800KB；无PDF/OCR/二进制附件。上游大规模批次应拆分后处理。
- 服务仅以单实例SQLite worker运行。服务重启将未完成任务标记中断，不自动再次产生模型费用。停止接收结果不会强行终止已发出的提供方请求。
- Node连接配置为服务端环境变量，本版未实现界面凭据设置。工作台源包不包含Python依赖与模型；独立服务源码和启动说明随Git仓库提供。

## 手工复验

1. 打开预览，修改档案名称及一条复核笔记，等待保存后刷新。
2. 选择“数量”，查看原文高亮，填写修订值并采用，导出CSV和JSONL；CSV有修订，JSONL保留原始值。
3. 编辑原文，确认区间停止高亮与接受禁用；恢复原文后定位恢复。
4. 在抽取配置输入不完整JSON，刷新后确认草稿恢复，已应用示例未被替换。
5. 导入新的官方JSONL，确认形成新项目，旧项目可重新打开。
6. 双窗口修改同一项目，确认第二份旧版本输入不覆盖较新的项目。
7. 未配置服务时应显示离线审校；真实模型与客户端导入需在对应环境单独验证。

截图：1440×1243；SHA-256 `a5d4eef95117713c1fc8ce3f656659b4bf747e180e5fe7348cff8ef0dc19397d`。
