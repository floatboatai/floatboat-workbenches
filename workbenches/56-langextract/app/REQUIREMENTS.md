# LangExtract 证据字段复核台

输入为普通非医疗文本、LangExtract AnnotatedDocument JSONL 或完整工作台项目。支持多份资料、字段定义和 few-shot 示例、字符区间高亮、接受/驳回/修订、笔记、CSV/原始JSONL/完整项目导出。原始结果不可被人工修订覆盖；原文变化使旧区间失效。输入、配置、未完成 JSON 草稿和修订自动保存。

使用独立 Python langextract==1.7.1 服务调用 lx.extract，模型与连接凭据留在服务端。任务 ID 与输入先落盘，断线后查询原任务，结果须明确另开为新项目。未连接时显示原因；示例不能称为模型结果。

本地业务、服务契约、真实模型、Host 和 Floatboat 客户端导入分别验收。样例仅普通商业访谈。
