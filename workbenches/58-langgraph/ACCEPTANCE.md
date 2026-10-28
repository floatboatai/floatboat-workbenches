# LangGraph 0.4.1 验收

日期：2026-10-27（America/New_York）；0.4.1 Host 验证于 2026-10-28T02:45:49Z。0.4.0 的本地恢复证据沿用并单列，0.4.1 重跑构建、17 项测试和真实模型完整流程。环境：Node 22.22.2、pnpm 10.22.0、真实 Chrome（Playwright/headless）、固定模板 3b55d46f7ae25e939ce3299073c37ed334d69c02。

## 已通过

- `pnpm workbench:check`：manifest、依赖锁、类型与构建通过。保留共享 `autosave-client.ts` 的大模块提示，没有新业务模块的同类提示。
- `pnpm test`：17 项通过（原有 11 项＋6 项模型输出/错误回归）。使用真实 LangGraph 1.5.3 和临时 SQLite，覆盖 interrupt/Command、关库重开、pending writes、父链与 metadata、任务/复核幂等、输入不一致、乐观冲突、退回、取消迟到结果、模型失败不重发、启动中断恢复，以及无效日期/未整理长列表。新增实测 JSON 代码块、纯 JSON、CRLF、截断/额外文字、未知字段/错误类型/日期、token 上限及安全错误提示验证。
- `pnpm package`：源包成功生成；普通包不包含运行数据、检查点、IndexedDB 缓存或凭据。归档 CRC 检查通过，两份上游 MIT 许可通过声明资源实际包含在包中。客户端导入单列未验证。
- Chrome 主流程 12 项：真实启动并暂停；复核草稿刷新恢复；修改后交付不覆盖下一轮输入；JSON 与 Markdown 导出；无效 JSON 草稿恢复；保存响应延迟时继续编辑；服务提交后丢响应重试同一 mutation；项目导入创建新项目且不重放运行；375px 无页面横向溢出；键盘可达；无 pageerror。
- Chrome 恢复流程 7 项：启动响应丢失后刷新/核对仍只有一个运行；新服务进程从相同检查点和人工草稿继续；旧列表迟到不覆盖新完成状态；重启后交付保留修订；跨窗口冲突不覆盖服务器；41 行未整理输入按草稿完整恢复；真实 Host 断开时模型按钮与提示准确。
- Chrome 多任务草稿 3 项：两份待复核运行的修改互相独立；刷新后两份草稿均保留；选中任务交付自己的修订内容。

0.4.0 共 22 个浏览器检查项；桌面 1440×1100、窄屏 375×900，reduced-motion。真实服务重启通过 PID 变化及 SQLite 中同一 run ID 证明，未以重新创建任务代替恢复。所有截图使用普通示例资料。

## 业务边界

填写资料模式实际执行 LangGraph 的准备、人工中断、恢复和交付；此模式没有模型调用。0.4.0 的 Host 曾未连接；0.4.1 已使用真实 Host `generateText` 成功完成模型分支，默认显式选择 `gemini-3.8-flash`。测试中的 fake provider 仅用于失败、取消等合约，不算模型验收。

项目保存、复核草稿和流程运行独立。断线后重新查询已知 run ID；未确认提交保留原 operation ID。模型步骤没有已确认结果时拒绝自动重发；其远端执行和计费不由本工作台保证 exactly-once。

SQLite 草稿可随服务进程恢复。IndexedDB 的离线保护限定同一浏览器来源；不同预览端口或设备不共享本机缓存。源包导入不复制预览业务数据。项目 JSON 导出包含输入与 JSON 草稿，确认后的交付记录另行导出；不作为执行检查点迁移包。

## 视觉与界面检查

根据当前 Web Interface Guidelines 核查原生按钮、字段标签、键盘焦点、错误/未连接反馈、撤销风险确认、长文换行、响应式和 reduced-motion。初始恢复阶段禁止改写未加载资料；无装饰性动画、远程字体或外部 iframe。运行时保留固定 CSP。

`src/ui/App.tsx`: pass（页面与输入）

`src/ui/RecordFields.tsx`: pass（必填提示、日期、完整草稿）

`src/ui/ReviewPanel.tsx`: pass（复核决定、结果、状态）

`src/ui/style.css`: pass（焦点、窄屏、reduced-motion）

截图：`../../docs/screenshots/langgraph.png`，0.4.1 真实模型交付后的已保存状态，尺寸 1440×1313，SHA-256 `686185f8275b53d40f075cb7c8f68e91f79a12476f0e2ee4da30cba675e212ea`。

## 0.4.1 真实 Host 验证

使用普通示例“冬季展览灯光验收”，显式请求 `gemini-3.8-flash`。真实 Chrome 验证模型产出主题、负责人林晓、2026-11-15 日期、摘要与检查项；真实 LangGraph 暂停在人工复核。修改摘要和意见后等待已自动保存，刷新保留；通过后产生交付，5 个检查点保留，导出 JSON，再刷新仍为已交付。没有 pageerror。结构化证据见 [host-acceptance-0.4.1.json](host-acceptance-0.4.1.json)。

最初 Host 默认模型给 JSON 加 Markdown 围栏，旧 `generateObject` 返回 `LLM_OBJECT_INVALID`。先以真实文本建立失败回归，再改用 Host `generateText`＋单层围栏解析和严格业务验证。模型切换到 Gemini 3.8 后曾返回非约定日期，已在提示与 schema 明确 ISO 日期；另有一次 Host `LLM_REQUEST_FAILED`，后续新建的独立验证运行成功。没有悄悄回退其他模型，也没有自动重放失败运行。

本次证明工作台明确请求该模型并通过 Host 完成；工作台不持久化 Host 返回的模型元数据或供应商标识。SDK、Host 源码、模型路由与凭据管理未修改。客户端导入仍单独未验证。

## 尚未验证

- 除当前普通示例以外的不同模型、长资料和批量模型输出质量；一次成功不代表上游稳定性保证。
- Floatboat 客户端源包导入与授权。
- 非固定流程、任意子图、分布式多 worker 或历史检查点格式迁移；这些不在当前产品范围。
