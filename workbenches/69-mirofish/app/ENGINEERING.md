# MiroFish 原生结果复核实现

contracts/simulation.ts解析官方动作API响应、JSON数组和JSONL；JSONL round映射为round_num，event_type元事件忽略，缺平台需要明确选择，重复动作保留。保留action_args/result的JSON数据，不替换为提取摘要。人工批注按动作索引+平台+角色+轮次标识，角色说明按平台+角色编号；原始动作不被编辑器覆盖。

useReviewDesk负责原生草稿、工程导入、服务读取和保存生命周期；App组织角色轨、轮次、动作流与报告，ReviewPanel只编辑人工说明。原生输入先留完整draft，再显式应用为新项目；恢复文件仅采用snapshot.data/extra/title，不复用旧ID/revision/回执。新建/打开/导入期间冻结编辑，避免离开旧项目过程中的输入丢失。

server/mirofish-client.ts通过health/list/start/stop/run-status/detail连接官方服务；限定本机HTTP或HTTPS、拒绝重定向、10秒超时、流式1.5MB上限。结果simulation_id需与选择项一致；拒绝只有recent_actions的部分快照，不静默截取500条以内冒充完整。

项目持久化复用store/autosave-client/cache/SQLite。正文、批注与JSON草稿容量分别校验；未采用的错误JSON保持在extra，不覆盖已有模型。文件导入创建新项目，不修改旧来源。

模板SDK、CSP、tooling与既有迁移未改动。无Host模型声明，新增运行命令经官方后端执行，不直接写社交平台。真实契约依据官方源码；测试中的HTTP服务和手写例子不是live模拟。scripts/verify-upstream-contract.py核对原始源码SHA-256后执行未修改AgentAction数据类，检验原生格式fixture。

run-commands在SQLite预留本地命令身份，先持久unknown后才发送上游；不将本地ID假设为上游幂等键。停止/读取结果以simulation_id+started_at核对。useSimulationControl按文档和请求序号隔离迟到回调，单轮终态单调，导入将命令转成只读来源。详见RUN-INTEGRATION.md。
