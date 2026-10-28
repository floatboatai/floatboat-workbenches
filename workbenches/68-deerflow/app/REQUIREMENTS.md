# DeerFlow研究交付

支持官方REST ThreadStateResponse与DeerFlowClient.get_thread检查点历史JSON；精确保留原始字段，显示可见消息、todos、artifacts，提取HTTP(S)来源；报告人工修订、逐来源复核、原生JSON和Markdown/完整项目导出。已有会话同步只读；新增显式研究提交使用官方后台run API，服务端持久命令先于远端副作用。未知回执只读恢复，不自动重发，不执行导入历史命令。

自动保存brief、报告、证据备注、未应用JSON和同步记录。异步结果不覆盖新项目或人工报告。真实官方序列化器配LangChain消息用于格式验收，示例不算模型研究运行。live上游同步与客户端导入分别记录。

研究入口默认gemini-3.8-flash，依据官方context.model_name配置，尊重上游白名单。未配置服务禁用提交。保存简报、模型草稿、命令状态及取得的结果，结果载入不覆盖人工报告。
