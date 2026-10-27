# Mermaid 图形工坊

版本 0.1.0。本地与真实 Host 模型调用已验证；客户端导入尚未验收。

## 使用

从总仓库运行 `pnpm workbench prepare mermaid`，然后 `pnpm workbench dev mermaid`。编辑源码即更新实际 Mermaid 图形；可保存草稿、打开/重命名/删除项目，导出 .mmd 源码与 SVG。语法错误保留原文和上一份预览，并明确标为未更新，SVG导出暂停。

AI生成先显示候选源码，点击采用后才替换当前内容。生成服务失败时不会插入示例图。

## 验证

`pnpm test`：3项通过，含真实SQLite持久化、版本冲突和删除。Chrome实测渲染、保存刷新恢复、源码/SVG下载、无效语法恢复、真实Host生成与采用；1440px/375px及深色/reduced-motion通过。页面异常、失败请求、console error均为0。

`pnpm workbench package mermaid` 生成 artifacts/mermaid-studio-0.1.0.fbworkbench，在 Floatboat「我的→工作台→导入工作台」安装。包默认不携带本地数据。

## 范围

40,000字符、300边上限；严格模式，系统字体，不加载外部图像/图标包。当前验收覆盖流程图；其它Mermaid图形需按实际输入验证。
