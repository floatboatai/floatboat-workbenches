# 实现边界

- 固定 CircuitJS1 TS 源码保持原样，esbuild 0.27.2 保留类名；所有原生适配集中在 engine-source/bridge.js，元件策略在 engine-source/policy.js（纯函数，测试与桥接共用）。native renderer、SimulationManager 与 XML serializer 未重写。
- 原生编辑器运行在同源 iframe，严格使用父来源、source window、documentKey 校验消息。每次切换生成新 iframe，旧全局监听器随浏览上下文销毁；pagehide 停止求解与桥接计时器。
- 外层 React 只管理文档/笔记/回执/草稿与低频读数，不重建 native canvas。异步响应不使用项目数据库 id 作为实例生命周期。
- 切换前锁住父层写入，向 native 请求停止并冻结完整 source/view/未提交参数，确认后才运行 autosave leave；失败解冻；旧实例的迟到消息因 source/key 不匹配丢弃。
- source、original、notes、view 是正式模型；parameter（原生参数框）、slider（未完成的滑块表单）和 source（电路文本）是可恢复工作副本。速度、电流动画速度与滑块（adj）都在原生 XML dump 中，随正式 source 保存与导出，不新增表或迁移。
- 读数有效性：原生成功 timestep 回调关联配置指纹；needAnalyze/reset 立即失效；运行中下一时间步恢复。

## 0.9.0 引擎桥接

- 加载：引擎先以空电路初始化，取得自身的 dumpTypeMap / xmlDumpTypeMap 后用 policy 检查来源（文本或 XML，包括子电路模型内部），通过后才 readCircuit。旧版 17 类白名单与 256 条上限移除；现在只拒绝 BLOCKED_ELEMENTS、不识别类型、子电路库文件、DOCTYPE/ENTITY 与超过 4000 条目。加载完成前不发出任何快照，失败时不会以空电路覆盖用户数据。
- 放置：可放置 = 原生 classToLabelMap 中的全部类减去 BLOCKED；键盘快捷键同样过滤。加载后桥接回报 catalog，外层元件库据此禁用缺失项。
- 无副作用加固：SubcircuitModel 不再读浏览器全局模型（模型随电路文件保存）；SRAM 不显示本机文件选择；AudioOutputElm.playAudio 置空；上游滑块条最大位置 99 改为 100，使配置的最大值可达。
- 新消息：speed、current-speed、step（在原生 timestep 回调中停于下一步）、probe（选中元件状态行 + 可调参数，按元件签名缓存）、slider、add-slider（Adjustable + createSlider，先 pushUndo）、remove-slider、check-source（示例库预检）。导出不再暂停；复位保持运行状态。
- 读数：每个元件的电压/电流读取独立 try/catch（单端元件在首次 stamp 前没有第二个节点），轮询永不因单个元件中断。

## 示例库

服务端 `src/server/examples.ts` 从 notices 资源中的 `upstream/ts/public/setuplist.txt` 解析目录，只返回目录中列出的文件（文件名正则 + 目录成员双重校验），单个 200 KB 上限；资源缺失时返回 503 与说明。客户端布局示意由 `previewGeometry` 从端点生成，不执行引擎。

## 验证

`tests/parts.test.ts` 用上游 Menus.ts 校验元件库覆盖与排除理由、检索排序、文本格式检查、种子电路；`tests/examples.test.ts` 校验 366 条目录、文件完整性、路由白名单和预览几何；原有 circuit/app 测试保持。浏览器流程与证据见 ACCEPTANCE.md。
