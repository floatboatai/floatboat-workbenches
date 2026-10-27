# LogicFlow 工作台

状态：计划中，尚未实现。

目标：业务流程设计工作台：审批/SOP 绘制、节点规则和运行可视化

上游：https://github.com/didi/LogicFlow

适配路线：引入 @logicflow/core 和必要扩展，在 React 容器挂载；将节点数据映射为受控的 Floatboat Workflow 调用。

限制：图模型与 Floatboat 执行模型需显式映射；不要把图形连线视为已有完整业务执行语义。

许可：Apache-2.0
