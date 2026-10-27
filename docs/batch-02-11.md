# 第二批工作台

范围：catalog 编号 2–11。使用三个 Git worktree 并行开发，主仓库统一合并和更新状态。

| Worktree | 项目 |
| --- | --- |
| visual | Markmap、React Flow、SurveyJS |
| office | pdfme、Tiptap、PptxGenJS |
| data | Mermaid、Swagger UI、Vega-Lite、Observable Plot |

每个项目必须使用相应上游核心库，完成独立业务流程、SQLite 持久化与版本冲突保护、可用的导出或结果交付。模型失败不能替换为伪造结果。

应用源码在自己的目录中，可复用存储和网络逻辑；设计和核心交互分别实现。安装固定依赖并维护两份锁文件。每个项目分别通过类型/构建、业务测试、浏览器主流程、窄屏与错误状态检查，再生成源包。

各 agent 只修改负责的项目目录并提交自己的分支。root catalog、根 README 与批次验收记录由集成者维护。Host 导入没有实测时继续标明未验证。
