# Promptfoo 评测工作台

输入为 Promptfoo v3 结果 JSON（CLI export 的 results summary 或直接 summary）及限定 JSON 测试套件。支持多份报告、用例×提示版本矩阵、通过/失败筛选、基线列对照、逐单元复核、CSV/原结果/便携项目导出。当前是小批次评测，整个项目限750KB，单份结果限600KB。

独立 Node22 runner 使用真实 promptfoo@0.125.1 evaluate。允许固定 echo 确定性提供者验证模板与断言，或服务端配置的 OpenAI-compatible 模型；界面准确区分二者。禁止从导入套件加载任意脚本、插件、文件或 URL。任务先持久化、幂等提交、轮询、刷新恢复；服务重启的未完成任务显式 interrupted，不自动重跑。模型密钥仅在 runner 服务环境中。

每个项目含完整配置草稿、报告和人工复核。自动保存不得阻断编辑；无效 JSON 也作为未应用草稿恢复。源码包不包含外部 runner 的运行依赖，README 给出独立启动方法与准确验收范围。
