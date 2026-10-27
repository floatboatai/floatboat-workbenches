# Slidev 工作台

状态：计划中，尚未实现。

目标：面向开发者的 Markdown 技术分享工作台

上游：https://github.com/slidevjs/slidev

适配路线：作为专项：工作台管理 slides.md 与资料，使用外部兼容构建服务生成演示；若必须单包运行则重做 React 展示层。

限制：依赖 Vue/Vite 自定义编译链，无法把源码直接塞进当前 React 固定构建；录制/导出也需独立验证。

许可：MIT
