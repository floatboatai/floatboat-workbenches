# 纸张工坊工程

@pdfme/{ui,common,schemas,generator,converter,pdf-lib} 六包精确 5.4.6，React 19.2.3 + Node 22，遵循模板严格 TypeScript 与固定 Vite 编译。root/app 两份清单与锁一致，无运行时原生扩展。

DesignerPane 挂载独立上游 Designer，回调更新模板、卸载 destroy。初始快照只在项目/导入/模式更换时更新，输入不会重建。版式预览用真实纸张尺寸和页选择。字体从同源 OTF 获取 ArrayBuffer；生成器嵌入中文字形，CSS 使用同源字体。

上游 common/schemas 的 ESM 保留裸 buffer 导入，固定模板会拒绝该 Node 名称。因此 scripts/build-browser-vendor.mjs 用 esbuild platform=browser 将锁定依赖生成浏览器 IIFE，buffer 显式解析为浏览器 buffer/index.js。产物 app/src/vendor/pdfme-browser.js 通过 ?url 按需同源加载，不修改模板、Vite 或 CSP。UI 内部 React 16 与外层 React 19 通过 DOM 容器隔离。converter/pdfjs-dist 的两个可选 canvas 依赖边以及 path2d-polyfill 均从 root/app 锁中移除。

contracts/domain 验证外部 JSON；server/store 用参数化 SQLite 和 revision 乐观并发，409 保留当前内容。ui/workspace 通过 SDK page.fetch 调 /api/projects，Node/SQL/Host 仅在服务端。测试使用内存数据库，不接触预览数据。数据、凭据、SDK 和生成输出不提交源码。

验证顺序：pnpm workbench:check → pnpm test → pnpm dev 实际浏览器 → pnpm package。Chrome 1500px/375px 中文填值与保存刷新恢复；Designer 的 customer X 坐标从 22 改为 28，填写→设计往返及保存刷新后仍为 28；148×210 mm 双页 JSON 导入、按真实尺寸和选定页预览。下载 PDF 解析确认 2 页、中文可提取，栅格图检查正常。 PDF 主流程无需模型或外部服务。

## 自动保存与工作草稿

新增 0003_autosave.sql，旧迁移保持不变。autosave-server 在事务中保存完整工作副本，并仅将通过业务验证的内容写入 projects；documentId/mutationId 支持丢失响应后的幂等重试。客户端串行提交、防抖、IndexedDB 回退，documentKey/loadEpoch 仅在文档切换时更新。保存返回时不覆盖期间继续输入的内容。草稿状态与正式内容状态明确区分。

未完成业务输入由结构受限的恢复器处理；正文或设计器初始快照不依赖自动保存生成的项目 ID。

pdfme 的属性表单仅在值通过其内部校验后触发 onChangeTemplate；DesignerPane 因此捕获同源容器内受支持属性框的原始 input，存入 working-copy.extra.designerInputs。模型回调只清除值已吻合的输入，不能清除未应用内容。恢复面板以原字段名称为锚点，字段删除后拒绝套用到其它字段；数值和名称再次经过业务校验后才应用。实例仅在主动应用/丢弃草稿时重建。
