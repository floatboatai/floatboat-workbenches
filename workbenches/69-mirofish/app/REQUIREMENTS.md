# MiroFish 原生结果复核

导入官方run-status/detail或actions API响应、原生actions.jsonl，识别轮次、平台、角色、动作参数和结果；沿时间线过滤、复核、加注、记录假设，导出原生动作及完整审阅报告/工程。原始动作不改写，人工判断分层保存。

可配置官方MiroFish后端，通过只读health/list/run-status/detail接口读取已有结果。未配置Zep/模型服务时不伪造模拟。无账号无外部服务时仍可完整审阅导出的原生数据。

完整自动保存、未完成JSON草稿恢复、导入新项目、乐观冲突保护；真实浏览器验证与原生序列化格式测试。OASIS/Zep实时生成必须另行记录，不得将手工fixture当live。
