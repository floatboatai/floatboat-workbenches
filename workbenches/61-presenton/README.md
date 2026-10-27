# Presenton 工作台

从参考资料编排逐页 Markdown、大纲与演讲备注，连接 Presenton 制作演示文稿，再读取页面复核和下载原始 PPTX / PDF。带完整草稿自动保存、便携项目导入导出与可恢复的制作记录。

```sh
# Repository root
pnpm workbench prepare presenton
pnpm workbench check presenton
pnpm workbench test presenton
pnpm workbench dev presenton
pnpm workbench package presenton
```

本地编排、导入、复核和导出不需要模型服务。真实制作需要独立的 Presenton REST 服务；[配置说明](app/PRESENTON.md) 包含固定版本、启动、认证、任务恢复和下载范围。初始的城市绿荫计划是演示数据。

[产品要求](app/REQUIREMENTS.md) · [设计](app/DESIGN.md) · [工程说明](app/ENGINEERING.md) · [验收记录](app/ACCEPTANCE.md)

服务接入按上游真实接口实现，契约测试使用明确标记的测试响应。当前环境没有 Presenton 实例或模型凭据，真实生成和 Floatboat 客户端导入尚未验证。可导出 `.fbworkbench`，通过 **Floatboat → 我的 → 工作台 → 导入工作台** 安装；源包不含预览业务数据或服务密钥。
