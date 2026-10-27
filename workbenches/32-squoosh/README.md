# Squoosh 工作台

状态：计划中，尚未实现。

目标：图片压缩工作台：批量转换、压缩效果比较和导出任务

上游：https://github.com/GoogleChromeLabs/squoosh

适配路线：抽取浏览器编解码与预览逻辑，React 重建批处理界面，SQLite 记录任务及预设，文件放工作台资源目录。

限制：原 UI 使用 Preact 和自定义 Rollup/PostCSS；WASM、Worker 与编解码静态资产需专门迁移验证。

许可：Apache-2.0
