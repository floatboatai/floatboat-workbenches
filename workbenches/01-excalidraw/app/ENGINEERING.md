# 工程说明

- 页面：`WorkspaceApp.tsx` 管理项目目录与导航，`Whiteboard.tsx` 按需加载 Excalidraw 并处理编辑/导出。`CanvasBoundary.tsx` 处理编辑器加载错误。
- 服务：`app-route.ts` 注册业务 API 与 Host LLM 调用，`board-store.ts` 处理参数化 SQLite 存储和 revision 乐观锁。
- `contracts/boards.ts` 校验场景大小、标题和生成图形的节点/连接引用；测试使用独立临时数据库。
- 画布 JSON 内保存图片。为了符合模板 HTTP 请求上限，场景限制为 1.5 MB；不自动丢弃超限内容。
- 画布修改监听仅比较场景版本和背景色。保存、导出时才序列化完整场景，避免每次拖拽复制图片数据。
- Host 模型使用 generateText，随后解析 JSON 并进行业务校验。真实 SDK 错误和无效输出均显示失败，不插入示例图冒充结果。
- 字体从锁定的 npm 包经同源 API 提供。`src/vendor/` 的 pnpm 补丁让已配置字体源不再附加 CDN 后备地址，以适配宿主 CSP；不修改模板 SDK。
- 根目录与 app 的 pnpm 锁文件都包含相同补丁，补丁及 MIT 版权说明随源包分发。
- 模板与运行数据由根目录 prepare 命令下载/创建，不属于发布源码。命令见仓库 README；实际验收见工作台 README。
