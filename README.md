# Floatboat Workbenches

把成熟的 GitHub 项目接入 Floatboat，提供可编辑、可保存、可导出的业务工作台。

一个项目一个目录，按 `catalog.json` 的顺序实现。只有完成实际检查的项目才标记为已实现。其余目录仅记录范围，不代表已经可用。

## 当前进度

已实现：`01-excalidraw` 白板工作台。支持画布编辑、保存恢复、源文件/PNG/SVG 导出、文件导入与真实 Floatboat 模型生成。其余 49 个项目仍处于计划状态，下一项为 Markmap。

已安装仓库级 React Best Practices 与 Web Design Guidelines，入口见 `AGENTS.md`。各工作台分别制定设计方案，参见 `docs/design-principles.md`。

## 开发

需要 Node 22.16+（22.x）、pnpm 10.22.0 和 Git。

```sh
pnpm workbench list
pnpm workbench prepare excalidraw
pnpm workbench check excalidraw
pnpm workbench test excalidraw
pnpm workbench dev excalidraw
pnpm workbench package excalidraw
```

准备命令从官方仓库获取 `template.lock.json` 固定版本的工具链，并安装锁定依赖。SDK、编译器、缓存和本地数据不提交到此仓库。业务代码保存在对应工作台的 `app/` 中。

每个应用独立维护 manifest、依赖锁、SQLite 迁移、测试及验收记录。启动预览后使用终端打印的完整地址。生成的 `.fbworkbench` 位于该项目的 `artifacts/`，可通过 Floatboat 的「我的 → 工作台 → 导入工作台」导入。

## 许可

上游项目、商业扩展和模板 SDK 的许可分别适用。参考各工作台 README、`notices/` 与 `docs/licensing.md`。本仓库尚未选择覆盖所有项目的统一开源许可证。
