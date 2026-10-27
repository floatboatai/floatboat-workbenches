# LangGraph 0.4.0 本地验收

日期：2026-10-27。环境：Node 22.22.2、pnpm 10.22.0、真实 Chrome（Playwright/headless）、固定模板 3b55d46f7ae25e939ce3299073c37ed334d69c02。

## 已通过

- `pnpm workbench:check`：manifest、依赖锁、类型与构建通过。保留共享 `autosave-client.ts` 的大模块提示，没有新业务模块的同类提示。
- `pnpm test`：11 项通过。使用真实 LangGraph 1.5.3 和临时 SQLite，覆盖 interrupt/Command、关库重开、pending writes、父链与 metadata、任务/复核幂等、输入不一致、乐观冲突、退回、取消迟到结果、模型失败不重发、启动中断恢复，以及无效日期/未整理长列表。
- `pnpm package`：源包成功生成；普通包不包含运行数据、检查点、IndexedDB 缓存或凭据。归档 CRC 检查通过，两份上游 MIT 许可通过声明资源实际包含在包中。客户端导入单列未验证。
- Chrome 主流程 12 项：真实启动并暂停；复核草稿刷新恢复；修改后交付不覆盖下一轮输入；JSON 与 Markdown 导出；无效 JSON 草稿恢复；保存响应延迟时继续编辑；服务提交后丢响应重试同一 mutation；项目导入创建新项目且不重放运行；375px 无页面横向溢出；键盘可达；无 pageerror。
- Chrome 恢复流程 7 项：启动响应丢失后刷新/核对仍只有一个运行；新服务进程从相同检查点和人工草稿继续；旧列表迟到不覆盖新完成状态；重启后交付保留修订；跨窗口冲突不覆盖服务器；41 行未整理输入按草稿完整恢复；真实 Host 断开时模型按钮与提示准确。
- Chrome 多任务草稿 3 项：两份待复核运行的修改互相独立；刷新后两份草稿均保留；选中任务交付自己的修订内容。

共 22 个浏览器检查项；桌面 1440×1100、窄屏 375×900，reduced-motion。真实服务重启通过 PID 变化及 SQLite 中同一 run ID 证明，未以重新创建任务代替恢复。所有截图使用普通示例资料。

## 业务边界

填写资料模式实际执行 LangGraph 的准备、人工中断、恢复和交付；此模式没有模型调用。Host `generateObject` 分支已实现，但当前运行环境返回 HOST_NOT_CONNECTED，未取得真实模型成功输出。测试中的 fake provider 仅用于失败、取消等合约，不算模型验收。

项目保存、复核草稿和流程运行独立。断线后重新查询已知 run ID；未确认提交保留原 operation ID。模型步骤没有已确认结果时拒绝自动重发；其远端执行和计费不由本工作台保证 exactly-once。

SQLite 草稿可随服务进程恢复。IndexedDB 的离线保护限定同一浏览器来源；不同预览端口或设备不共享本机缓存。源包导入不复制预览业务数据。项目 JSON 导出包含输入与 JSON 草稿，确认后的交付记录另行导出；不作为执行检查点迁移包。

## 视觉与界面检查

根据当前 Web Interface Guidelines 核查原生按钮、字段标签、键盘焦点、错误/未连接反馈、撤销风险确认、长文换行、响应式和 reduced-motion。初始恢复阶段禁止改写未加载资料；无装饰性动画、远程字体或外部 iframe。运行时保留固定 CSP。

`src/ui/App.tsx`: pass（页面与输入）

`src/ui/RecordFields.tsx`: pass（必填提示、日期、完整草稿）

`src/ui/ReviewPanel.tsx`: pass（复核决定、结果、状态）

`src/ui/style.css`: pass（焦点、窄屏、reduced-motion）

截图：`../../docs/screenshots/langgraph.png`，尺寸 1440×1283，SHA-256 `d8e7b34b30790a500bc4ff0a81996b6862512cd9b01e70ce1774e89db988e074`。

## 尚未验证

- 真实 Host 模型成功调用、不同模型的结构化输出质量。
- Floatboat 客户端源包导入与授权。
- 非固定流程、任意子图、分布式多 worker 或历史检查点格式迁移；这些不在当前产品范围。
