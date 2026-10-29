# Promptfoo 评测台 · 0.9.0

提示词维护者需要在一次评测中比较多个提示版本、provider 和真实用例，定位退步，记录发布判断，交付可离线阅读的报告。

## 首次使用与核心任务

空数据库自动载入售后助手评测：36 个中英文工单、3 个提示版本、2 个示例录制 provider，以及仅参与一个提示版本的规则脚本，共 7 列、252 格。录制输出为手工编写的虚构示例，不是模型推理结果。无需 Floatboat、API key 或外部执行器，点击“运行评测”即可重新评分，导出 YAML、结果 JSON、CSV、HTML 和完整项目。

矩阵呈现通过、失败、执行错误、分数、耗时与成本；可筛选失败、退步、变化、待复核，搜索工单，比较同 provider 的提示版本或另一次运行。详情提供断言、实际提示、变量、输出差异、接受/修改判断和意见。列头维护发布判断；通过率、退步上限及错误容忍形成建议，存在未执行评分时不得自动建议发布。

## 配置与执行

- 读取 YAML/JSON 配置、Promptfoo v3 结果（兼容 v2 results 列表）、CSV/TSV 用例及便携项目。
- 支持 defaultTest、数组变量展开、providerPromptMap、提示变量与受限模板表达式；不支持的语法给出具体错误。
- 本机 provider：echo、录制回放、JavaScript 规则脚本；Floatboat provider 需要连接且授权的 Host，并在运行前确认调用次数。
- 21 类确定性断言：equals、contains、icontains、contains-any/all、icontains-any/all、regex、starts-with、is-json、contains-json、is-valid-openai-tools-call、is-valid-openai-function-call、javascript、levenshtein、rouge-n、bleu、latency、cost、word-count、finish-reason。支持 not-、weight、threshold、metric、transform 与一层 assert-set。
- 模型评分及其他未支持断言保留配置并标为未执行，不发起评分模型调用。可选官方执行器只核对 echo/录制列的确定性断言，不运行 Host 列和本机脚本列。
- 任务保存编号与冻结输入后提交，丢回执按原编号查询/重试，刷新恢复；本机任务支持停止，服务重启将未完成任务标为 interrupted。

## 文件生命周期与保存

“评测”菜单提供空白评测、示例、最近评测、导入、导出与恢复。编辑自动保存，不以“新建项目/立即保存”作为主流程。YAML/项目/恢复草稿导入创建新的评测；结果 JSON 加入当前评测；CSV 追加用例。未生效 YAML 保留为草稿，不替换已生效配置。恢复草稿不恢复可执行任务；完整项目携带运行原文，恢复草稿仅保留本机结果引用。

自动保存验收覆盖延迟期间继续输入、服务已提交后丢回执、无效草稿刷新恢复、导入新建、离线本机恢复和乐观锁冲突。冲突不得覆盖服务器新版本。

## 容量与边界

单个输入/结果最多 40 MiB，结果最多 20,000 格；运行最多 2,000 用例、24 提示、24 providers、6,000 格；每个评测最多 60 次运行。配置最多 600,000 字符，项目元数据 880,000 字节，恢复草稿模型 1,500,000 字节，含额外草稿字段的保存请求 1,950,000 字节。结果原文独立存储，不占项目元数据配额。超限明确报错。

验收使用 Node 22、独立 SQLite 和无头 Chrome 的 1440/375 宽度。真实 Host/LLM 和 Floatboat 客户端导入不属于本次已验证范围；Host 使用合同 mock。实际结果见 ACCEPTANCE.md。
