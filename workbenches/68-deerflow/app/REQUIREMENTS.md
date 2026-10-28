# DeerFlow研究交付

支持官方REST ThreadStateResponse与DeerFlowClient.get_thread检查点历史JSON；精确保留原始字段，显示可见消息、todos、artifacts，提取HTTP(S)来源；报告人工修订、逐来源复核、原生JSON和Markdown/完整项目导出。上游同步只读，使用明确线程ID及服务端配置，不启动研究推理、工具执行或重放导入会话。

自动保存brief、报告、证据备注、未应用JSON和同步记录。异步结果不覆盖新项目或人工报告。真实官方序列化器配LangChain消息用于格式验收，示例不算模型研究运行。live上游同步与客户端导入分别记录。
