# MiroFish 官方运行接入

0.9.0 起这是可选通道：默认地址为上游 Flask 默认 `http://127.0.0.1:5001`；读取的结果（detail 上限 40MB）进入本机结果库并作为“MiroFish”运行追加到当前推演，而不是新建复核项目。本地推演、观察与报告不依赖本通道。

固定上游提交7657031ac01184afe2cb220f5ee3545573b5e843。

## 官方契约

- backend/app/api/simulation.py:1501：POST /api/simulation/start，simulation_id、platform、max_rounds、enable_graph_memory_update、force。工作台明确发送force=false与enable_graph_memory_update=false。
- 同文件:1788：POST /api/simulation/stop，只传simulation_id。202且success=false、pending=true表示正在完成停止；工作台查询状态，不再次发送。
- 同文件:1865：GET /api/simulation/<id>/run-status；无运行时idle且没有started_at。
- 同文件:1923：GET /api/simulation/<id>/run-status/detail；全量all_actions及started_at用来读取本次结果。
- backend/app/services/simulation_runner.py:110与:371：状态包含simulation_id、runner_status、started_at、updated_at；没有独立run_id或客户端幂等键。启动对活跃模拟有锁，但已结束后的POST可能重新运行，因此不能用再次POST猜测丢失回执。

## 命令与恢复

UI把命令UUID、模拟ID、操作、平台、轮数和停止目标started_at写入完整draft，并等待保存回执。服务端同步预留SQLite记录后才开始异步工作；通过条件检查后先持久标为unknown再发送一次POST。重复相同ID只返回原记录；内容变化拒绝；同一模拟的重复启动/同一started_at的重复停止拒绝。进程崩溃留下submitting/unknown时只核对，绝不重放。

收到有效回执为acknowledged；未知回执后观察到simulation_id的started_at为observed，不声称已证明因果归属。没有发现启动时仍未知，保留记录。界面每4秒查询，也支持手工核对，查询序号和documentKey隔离迟到响应，服务端与UI均保护同轮终态。

停止预检started_at与当前一致，随后使用官方stop接口；上游没有条件停止字段，因此另一客户端在预检后立即重启的竞态无法原子排除。工作台明确要求同一模拟在单一入口管理。已识别的不同运行会拒绝停止，结果读取也必须匹配started_at。

恢复工程导入将pendingRun移动到importedRun并清除运行选择，作为只读来源保留，绝不自动执行。原项目保留命令关联；未核对命令阻止无意导航覆盖。已有结果复核与独立批注继续保留。

## 证据边界

合同测试覆盖官方HTTP字段、真实SQLite命令账本、丢上游回执及状态不可用、重建账本后恢复不重放、202停止、不同运行拒绝、迟到终态与导入不重放。

真实Chrome使用明确标识的本地HTTP合同服务，走完整选择→显式启动→丢回执/查询阻断→刷新→核对→停止→读取结果→导入工程流程。合同服务不是OASIS/Zep引擎。本次没有配置真实模型/Zep服务，live模拟执行未验证。未连接服务的真实浏览器状态另行验证；普通示例不包含用户文件或凭据。
