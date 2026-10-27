# 思路图谱（Markmap）

已实现并完成本地验收。基于 markmap-lib/view 0.18.12，原项目：https://github.com/markmap/markmap。

## 功能

Markdown 大纲实时转换为交互脑图；新建、保存、打开和删除项目；版本冲突保护；导入 Markdown；导出原文和自包含 SVG。AI 将材料整理为提纲，先展示生成稿，由用户采用后再保存。

## 运行

从总仓库运行 `pnpm workbench prepare markmap`，然后 `pnpm workbench dev markmap`。验证用 `pnpm workbench test markmap`，交付用 `pnpm workbench package markmap`。在 Floatboat 的「我的 → 工作台 → 导入工作台」导入生成的 `.fbworkbench`。

## 初版验证记录（0.1.0）

- 类型、构建和 3 项测试通过：输入边界、持久化重开、保存和删除版本冲突。
- Chrome 1440px / 375px 真实编辑、保存刷新恢复、Markdown/SVG 下载通过。
- SVG 写入明确尺寸与完整图谱 viewBox，预览未对应当前大纲时禁止导出；下载后独立打开验证所有节点位于视图内。
- 原生 HTML 与图片不渲染，脚本/危险链接测试未执行。
- 真实 Floatboat LLM 请求成功（HTTP 200），生成稿采用流程通过。
- 深色与 reduced-motion 检查通过；页面异常 0、失败资源请求 0，375px 无横向溢出。
- 源包已生成。Floatboat 客户端导入尚未验收。

## 边界

大纲上限 50,000 字符、500 行。禁用远程数学/高亮插件与图片，不渲染外部链接。SVG 使用 foreignObject，第三方编辑器支持程度不同；Markdown 是可恢复源格式。

## 许可

Markmap 上游为 MIT，版权文本保存在 `app/src/notices/markmap.LICENSE`。DOMPurify 按其依赖包许可使用；这不为整个应用选择新的统一许可证。

## 0.2.0 自动保存与产品布局

脑图主体与可收起大纲、轻量工具条。编辑后 700ms 防抖自动保存，提交串行且不锁定输入；IndexedDB 暂存、SQLite 工作草稿与合法项目分别保存。无效输入仍保留为草稿，网络失败和版本冲突明确提示并可导出恢复文件。导入创建新项目，打开/新建先同步旧草稿，只有需要放弃未同步内容时才确认。本项目保留Markdown、AI 描述与待采用提纲。

本轮 `pnpm workbench:check`、`pnpm test`（4 项）通过；真实 Chrome 验证自动保存、刷新恢复、业务导出、375px、深色模式和 CSP 资源。桌面截图见 README 图片。最终 0.2.0 包由总仓库统一打包；Host 导入仍需在客户端验证。
