# 写作台工程

@tiptap/{react,core,pm,starter-kit} 四包精确 3.32.0，React 19.2.3 + Node 22，遵循模板严格 TypeScript 与固定 Vite 编译。root/app 两份清单与锁一致，无运行时原生扩展。

RichEditor 懒加载，useEditor 配置 immediatelyRender:false 与 shouldRerenderOnTransaction:false，useEditorState 只订阅工具栏状态。initial 只随项目、导入、采用草稿更换，输入不会重建编辑器。

contracts/domain 验证节点父子语法、深度、文本总量、标记及 URL。HTML 由 generateHTML 从验证过的 JSON 生成，不直接接收任意 HTML。链接统一 noopener noreferrer。AI 返回 JSON 后再次验证，预览/采用/放弃独立处理，项目切换使旧请求失效。

contracts/domain 验证外部 JSON；server/store 用参数化 SQLite 和 revision 乐观并发，409 保留当前内容。ui/workspace 通过 SDK page.fetch 调 /api/projects，Node/SQL/Host 仅在服务端。测试使用内存数据库，不接触预览数据。数据、凭据、SDK 和生成输出不提交源码。

验证顺序：pnpm workbench:check → pnpm test → pnpm dev 实际浏览器 → pnpm package。Chrome 1440px/375px 输入并加粗→保存刷新恢复→JSON/HTML 导出，导出的 HTML 包含真实 strong 标记。危险链接、非法节点语法、空项目与数据库冲突测试通过。 真实 Floatboat llm.generateText 成功返回中文草稿并停留在预览区，未自动覆盖正文。另明确注入 HTTP 503 验证失败时要求和正文保留；注入结果不作为真实模型成功证据。
