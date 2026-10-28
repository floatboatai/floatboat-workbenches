# LangGraph 0.4.1 · Gemini 3.8 与真实 Host 验收

日期：2026-10-27（America/New_York）；实际模型流程完成于 2026-10-28T02:45:49Z。仅更新 LangGraph，仓库仍为32/61项完成本地验收，其他五个AI工作台保持0.4.0。

## 行为变化

LangGraph 模型整理默认请求 `gemini-3.8-flash`，由 Floatboat Host 处理路由与凭据。调用 Host `generateText` 后只接受完整 JSON 或单层完整 JSON 代码块，严格校验五个交付字段、日期、长度及正常结束状态；schema与提示明确YYYY-MM-DD日期。截断、额外文字、非法字段仍会失败并保留输入与运行，不自动回退模型或重复调用。

已解决旧 Host `generateObject` 直接解析模型 Markdown 围栏而返回 `LLM_OBJECT_INVALID` 的问题。应用错误提示按连接、账号、权限与模型错误代码区分，不再把所有错误都归为未启动客户端。SDK、Host客户端及其全局默认模型设置没有改动。

## 实际验证

- 构建、类型与 **17项应用测试通过**，其中6项为模型输出及安全错误提示回归。
- 真实 Host + Chrome：普通示例资料 → Gemini 3.8整理 → LangGraph人工中断 → 修改摘要与意见 → 自动保存 → 刷新恢复 → 通过并交付 → JSON导出 → 再次刷新保持交付。
- 交付记录包含正确主题、负责人、日期和检查项，保留5个检查点，浏览器无pageerror。最新[截图](screenshots/langgraph.png)为真实模型完成后已保存的状态。
- 源码包生成成功，CRC及源码/资源字节对应验证通过；保留上游许可证，排除预览数据和凭据。

验证期间，Gemini 3.8曾返回非约定日期（随后明确输出schema与提示）；另一次请求返回`LLM_REQUEST_FAILED`，新建的独立验证运行成功。失败运行保留，没有自动重放。一次普通示例成功不等于上游稳定性或任意资料质量保证。模型ID在应用请求中显式指定，应用不持久化Host返回的模型元数据。

详细过程与边界见[项目验收](../workbenches/58-langgraph/ACCEPTANCE.md)和[结构化证据](../workbenches/58-langgraph/host-acceptance-0.4.1.json)。Floatboat客户端源码包导入仍未实测；独立Python/HTTP服务仍按[AI服务说明](ai-services.md)配置。

## 使用

运行：`pnpm workbench dev langgraph`。导入：Floatboat → 我的 → 工作台 → 导入工作台，选择0.4.1的`.fbworkbench`文件。普通源码包不迁移开发预览的业务数据。
