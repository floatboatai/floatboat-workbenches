# 工程说明

contracts/form.ts允许列表校验问卷和答案。server/routes.ts提供项目版本存储；responses.ts独立保存答卷、模式快照与幂等提交ID。提交前检查项目revision，避免用旧问题提交新版本。

SurveyRunner.tsx按需加载survey-core/react-ui 3.2.2，使用核心CSS和系统字体；模型完成事件触发真实API写入，失败保留待重试数据。onProcessHtml通过DOMPurify限制标签。

答卷不嵌入项目定义，修改问题不会改写历史答案。并发提交由SQLite主键幂等保证。全部服务请求同源。公开问卷链接、远程收集和商业Creator不在当前范围。

JSON 编辑保存独立草稿基线，并接入本目录 useProjects 的外部 dirty 状态。未应用草稿阻止保存、定义导出和进入填写页；取消新建、打开、关闭编辑器会保留原文。项目切换仅在操作成功后重置编辑器。答卷加载有请求序号，防止切换时旧请求覆盖新项目结果。

SurveyJS 3.x 使用 --sjs2-* CSS 变量，设置在 sd-theme-root 上；仅引用系统字体。textUpdateMode=onTyping 使输入即进入未提交状态。允许列表不保留表达式、脚本、HTML 题型、远程选项、外链或文件上传，因此不需要 unsafe-eval 或额外 CSP 放行。
