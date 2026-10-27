# 工程说明

contracts/flow.ts验证JSON并执行纯文本单链，客户端和服务端共享业务约束；真实执行在/api/run，结果随后通过带版本的项目API保存。FlowCanvas.tsx按需加载React Flow 12.12.0，使用受控节点/边和预构建CSS。

lastRun包含配置签名、每一步输入输出和时间；签名不含位置变化。流程不是Floatboat通用工作流执行器，不会触发任意外部操作。Host仅用于生成待采用的配置。

节点最多30，连接60，结果20000字符，项目900KB。非法执行不会产生成功记录。运行和保存失败分别在UI反馈。

## 0.2.0 工作草稿

使用公共 autosave contracts/client/cache/requests/server，追加独立迁移，不改原迁移。`documentId` 与 `mutationId` 去重；草稿 revision 与项目 revision 分别验证。UI 用 `documentKey`/`loadEpoch` 表示文档切换，后台保存不换 key。额外输入放 `draft`；宽松但限定类型的恢复器允许业务校验尚未通过的编辑值。
