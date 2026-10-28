# 实现边界

- 固定 CircuitJS1 TS 源码保持原样，esbuild 0.27.2 保留类名；所有原生适配集中在 engine-source/bridge.js。native renderer、SimulationManager 与 XML serializer 未重写。
- 原生编辑器运行在同源 iframe，严格使用父来源、source window、documentKey 校验消息。每次切换生成新 iframe，旧全局监听器随浏览上下文销毁；pagehide 停止求解与桥接计时器。
- 外层 React 只管理文档/笔记/回执/参数草稿与低频读数，不重建 native canvas。异步响应不使用项目数据库 id 作为实例生命周期。
- 切换前锁住父层写入，向 native 请求停止并冻结完整 source/view/未提交参数，确认后才运行 autosave leave；失败解冻；旧实例的迟到消息因 source/key 不匹配丢弃。
- source、original、notes、view 是正式模型；parameter 和 source 文本是可恢复工作副本。当前仿真读数在原生成功 timestep 回调关联配置指纹；needAnalyze/reset 立即使读数失效，轮询不赋予有效性；参数修改后显示待运行。
- 数据由 SQLite 乐观版本保存，IndexedDB 保留离线副本；冲突只保留草稿。没有模型调用、外部持久化、后台自动运行或真实硬件接口。
- 原生静态资源通过 resources.path 解析声明路径；源码包资源重定位后可工作。未改模板 SDK、tooling 或 CSP。PNG data URL 在内存解码，不进行 CSP 禁止的 data URL fetch。
- 资源与源码的 GPL/第三方许可在 notices 和 LICENSE；原始源码 SHA 清单由测试核验。

## 0.8.1 信息架构

App 的首屏变为纵向元件架、全幅原生电路/Scope 和底部时基/探针/读数仪器台。原生 iframe 继续使用原 documentKey；实验簿 dialog 的开关/页面切换只改变外层 UI，不改变 iframe 身份。文件生命周期与笔记从实验簿进入；Esc/关闭返回触发器，Tab 在对话框内循环。移动端探针操作保留至少 28 px 点击区与键盘入口。transition 期间统一禁用旧对象字段/实验簿切页/对象操作，背景自动保存不锁定输入。

本次不改 engine/engine-src、求解/测量有效性、服务端、契约、存储标识和自动保存实现。原 App 的桥接消息、冻结切换、导出和导入函数保持原字节内容；只调整调用入口和呈现位置。GPL 源码、资源与重建边界不变。
