# 问卷工作台（SurveyJS Form Library）

已实现并完成本地验收，使用 survey-core / survey-react-ui 3.2.2。上游：https://github.com/surveyjs/survey-library。

## 功能

设计、填写、答卷三个视图：使用自有题目编辑界面或受限 JSON 定义问卷，真实 SurveyJS 表单渲染、必填检查、提交到 SQLite，按提交时的问题快照查看答案并导出 JSON。AI 生成问卷先预览，再由用户采用。

JSON 未应用时保留草稿，禁止保存及定义导出；取消新建、打开或关闭编辑器会保留原文。填写未提交时离开会提醒。提交失败保留答案并可重试，同一提交标识去重，避免重试产生重复记录。问卷保存有版本冲突检查。

## 运行

总仓库：`pnpm workbench prepare surveyjs-form-library` → `pnpm workbench dev surveyjs-form-library`。测试：`pnpm workbench test surveyjs-form-library`。打包：`pnpm workbench package surveyjs-form-library`，在 Floatboat「我的 → 工作台 → 导入工作台」使用源包。

## 验证

- 类型/构建和 5 项测试通过，涵盖模式允许列表、答案类型、必填与选项、幂等提交、历史快照、版本冲突。
- Chrome 1440px 与 375px：设计、JSON 草稿取消保护、有效定义应用/导出、必填提示、正常提交、刷新恢复、答卷项目切换和答案导出通过。
- 保存成功但列表刷新 503 时，项目摘要即时更新，仍可继续填写；不会把已保存状态当成失败。
- 注入一次 503 提交失败，重试后正确保存；两次有效提交最终为两份答卷，没有重复记录。
- 真实 Floatboat LLM 问卷生成成功（200），建议不会自动覆盖当前问卷。
- 页面异常 0，失败请求 0；设计/填写/答卷窄屏横向溢出均 0。控制台一条 503 是主动注入的重试验收响应。
- 已检查深色主题与 reduced-motion，源包导出通过；Host 客户端导入尚未验收。

## 范围与许可

每份问卷 1–50 道题；支持简答、长文本、单选、多选、下拉选择、判断及 1–5 评分。选择题 2–20 个选项；每项目最多 500 份答卷，单份最多 50 KB。只允许纯文字和受支持的字段，不运行任意表达式、HTML、脚本或远程选项。

这是在当前工作空间内收集答案的工具，不提供公开问卷分发链接。使用 MIT Form Library，不含商业 Survey Creator、Dashboard 或 PDF Generator。上游许可见 NOTICE.md；本仓库未为所有新增应用统一选定许可证。
