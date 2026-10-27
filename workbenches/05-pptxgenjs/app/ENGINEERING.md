# 演示编排室工程

pptxgenjs 精确 4.0.1，React 19.2.3 + Node 22，遵循模板严格 TypeScript 与固定 Vite 编译。root/app 两份清单与锁一致，无运行时原生扩展。

官方 ESM 留有 Node fs 动态导入，固定模板会拒绝；使用 npm 官方 dist/pptxgen.bundle.js 原始副本作为 app/src/vendor 资源，以 ?url 同源 script 按需加载，类型仍来自 import type。不修改模板编译器或 CSP。

export-deck 构建 LAYOUT_WIDE、主题、文字/线条/页号、addNotes，write(outputType:blob) 返回真实 Office ZIP。Microsoft YaHei 为字体名称，文件未嵌入微软字体。moveSlide 使用不可变排序。模型结构化返回再次验证，确认采用之前不改变当前页面。

维护时运行 node scripts/copy-browser-vendor.mjs 复制官方资源，再运行 node scripts/collect-licenses.mjs 更新许可汇编。

contracts/domain 验证外部 JSON；server/store 用参数化 SQLite 和 revision 乐观并发，409 保留当前内容。ui/workspace 通过 SDK page.fetch 调 /api/projects，Node/SQL/Host 仅在服务端。测试使用内存数据库，不接触预览数据。数据、凭据、SDK 和生成输出不提交源码。

验证顺序：pnpm workbench:check → pnpm test → pnpm dev 实际浏览器 → pnpm package。Chrome 1440px/375px 添加/删除/排序→保存刷新恢复→PPTX/JSON 导出。解压验证 3 页 OOXML 顺序、中文正文和备注。LibreOffice 能打开并转 PDF；渲染验收使用 Noto CJK 替代 Microsoft YaHei。 真实 Floatboat llm.generateText 返回 3 页中文大纲并停留在待采用区，未自动替换页面。另明确注入 HTTP 503 验证输入与页面保留；失败注入与真实 Host 成功分开记录。

## 自动保存与工作草稿

新增 0003_autosave.sql，旧迁移保持不变。autosave-server 在事务中保存完整工作副本，并仅将通过业务验证的内容写入 projects；documentId/mutationId 支持丢失响应后的幂等重试。客户端串行提交、防抖、IndexedDB 回退，documentKey/loadEpoch 仅在文档切换时更新。保存返回时不覆盖期间继续输入的内容。草稿状态与正式内容状态明确区分。

未完成业务输入由结构受限的恢复器处理；正文或设计器初始快照不依赖自动保存生成的项目 ID。
