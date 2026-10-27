# Fabric.js 工作台

状态：计划中，尚未实现。

目标：海报与标注工作台：对象化编辑、批量改文案、模板出图

上游：https://github.com/fabricjs/fabric.js

适配路线：使用浏览器包在 React 容器创建画布；以 JSON 保存对象模型，Agent 修改文本和坐标，浏览器完成渲染导出。

限制：工具栏、模板管理与业务 UI 需自行构建；Node 渲染依赖 node-canvas，不适合模板纯 JS 运行 profile。

许可：MIT
