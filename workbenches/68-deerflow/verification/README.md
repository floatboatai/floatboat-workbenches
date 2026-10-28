# 原生格式验证

`deerflow_serialization.py`逐字来自DeerFlow提交`d4ed40075f9101db6424b2331ea410934af146ac`的`backend/packages/harness/deerflow/runtime/serialization.py`，MIT原文在app/notices。

Python3.12环境安装requirements-lock.txt后运行`python verify_native.py`。它使用真实LangChain HumanMessage/AIMessage/ToolMessage调用上游官方序列化器，生成普通示例ThreadStateResponse，并检查隐藏base64图片被剥离。没有调用模型或执行研究/检索工具，tool调用和报告内容均为明确样例。
