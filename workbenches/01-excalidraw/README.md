# Excalidraw 工作台

状态：本地与真实 Host 模型调用已验证，版本 0.1.0。尚未完成 Floatboat 客户端导入验收。

目标：AI 白板：需求讨论、产品草图、流程图与项目画布存档

上游：https://github.com/excalidraw/excalidraw

适配路线：嵌入 @excalidraw/excalidraw 发布包及 CSS；将画布 JSON 与附件存入工作台，服务端 Agent/LLM 生成或修改结构化画布。

限制：协作、分享和云存储不等于 npm 组件自带；字体及静态资源要按模板打包。

许可：MIT

## 已实现

创建、搜索、重命名、保存与删除画布；保存版本冲突检查；导入 `.excalidraw`/JSON；导出源文件、PNG 和 SVG；通过 Floatboat 模型生成可编辑的节点与连线。场景大小限制为 1.5 MB。

编辑器按需加载，画布变化监听使用轻量版本指纹。字体由当前服务提供；`app/src/vendor/` 的小逻辑补丁避免 Excalidraw 注册不适用的外部字体后备源，补丁随 pnpm 锁文件及应用源包分发。

## 运行

从总仓库根目录执行：

```sh
pnpm workbench prepare excalidraw
pnpm workbench test excalidraw
pnpm workbench dev excalidraw
pnpm workbench package excalidraw
```

启动后打开命令输出的完整地址。运行兼容的 Floatboat 并登录后，模型能力会自动连接。模型服务不可用时，手动编辑与保存继续可用。

导出的源包位于本目录 `artifacts/`。在 Floatboat 选择「我的 → 工作台 → 导入工作台」。再次导出时使用新版本或另一个 `--output` 路径，工具会保留既有产物。

## 验证记录

- 固定依赖安装、类型与构建检查通过。
- 4 项测试通过，覆盖持久化、保存/删除冲突、非法与超限文件、生成图形的引用一致性。
- Chrome 实测创建、绘图、保存、刷新恢复、服务重启后恢复、文件导入及三种格式导出。
- 真实 Host 模型生成返回成功，画布由 1 个元素增加到 6 个，元素标识无重复。
- 375px/1440px、深浅主题、reduced-motion 和 Escape 操作通过。最终主流程没有页面异常或失败资源请求。
- 进入画布前不加载编辑器 chunk；首屏入口约 209 KB（构建产物，未压缩）。
- `.fbworkbench` 打包通过，包含依赖补丁和第三方版权说明，不包含本地用户数据。

本地浏览器通过不等于 Host 导入通过；客户端安装与面板贡献需单独验证。部分上游 Radix 依赖仍声明旧 React peer 范围，本项目验证的实际组合为 React 19.2.3 与 Excalidraw 0.18.1。
