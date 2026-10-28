# Ray Optics 工作台工程

固定原生核心来自ricktu288/ray-optics，提交daf76772c73a85e1a2568c4e2e71613bba1fab77（5.5.0）。选定12个基础/编辑辅助类型，场景JSON不支持的对象、模块、背景图与复杂渲染路径明确拒绝。上游源、逐文件哈希、Apache2许可在notices资源；仅ESM导入兼容、注册表限制和嵌入画布坐标换算做适配，不重写光学算法。使用原生Scene、Simulator与Editor；只CPU常规颜色。

React管理业务工作稿；NativeBench拥有canvas、原生对象、监听与计时器。documentKey+实例存活令牌防止旧回调污染新项目。原生事件发布后不再反向loadJSON，外部导入/原始编辑明确应用才替换场景。原件及不支持的输入保持为可下载草稿。

SQLite正式项目与完整工作稿独立。正式UTF8预算850000字节、工作结构恢复2000000字节，完整请求1950000字节；字段限制与原始JSON边界统一。默认源码包不含业务数据，不使用Host模型。

验证：pnpm workbench:check、pnpm test、真实Chrome桌面/375px/keyboard/reduced-motion，实际原生场景与探测器输出、JSON/PNG导出、保存故障矩阵、源码包CRC/资源路径/许可证。客户端导入单列未验证。

计算结果以每实例的revision及scene.toJSON快照绑定；编辑、缩放、resize、外部load、停止和切换均取消原生分片timer并清除active/completed stamp。迟到完成回调及PNG只能使用同一revision的结果。原生Scene.pushObj用于新增元件，不仿造物理实现。

恢复文件外层允许12MiB以涵盖snapshot/current/pending，inner snapshot必须<=1950000字节，与共享AS请求预算一致。成功解析后才替换文档，不把完整cacheValue塞入旧稿raw。可容纳的拒绝输入保存raw；超限文件明确拒绝并要求保留本地原件。
