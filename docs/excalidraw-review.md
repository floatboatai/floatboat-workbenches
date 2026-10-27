# Excalidraw 首轮技能应用

2026-10-26。依据仓库内 `react-best-practices` 与 `web-design-guidelines`，Web Interface Guidelines 从官方源重新获取。

- `WorkspaceApp.tsx`：编辑器改为 lazy/Suspense，文件解析库只在导入动作中加载。加入编辑器错误边界。
- `Whiteboard.tsx`：每次画布变化仅计算版本指纹，保存/导出时才序列化图片及场景。静态编辑器选项与菜单提升到组件外。
- `WorkspaceApp.tsx`：加入跳转到主操作区的链接、表单 name/autocomplete、Escape 关闭，移动端避免自动抢占输入焦点。
- `Whiteboard.tsx`：给表单补齐语义；原生控件保留焦点反馈；装饰图标隐藏于读屏；适应画布操作支持窄屏重新定位内容。
- `studio.css`：补齐触控目标、focus-within、safe area、长列表 content-visibility 和 reduced-motion。

复测：真实编辑/保存/恢复/导入/导出通过；真实模型生成成功；浏览器页面异常 0，失败资源请求 0，375px 页面宽度与滚动宽度均为 375px。

改造建议没有引入 Next.js；当前 Floatboat 固定 React/Vite 构建继续适用。项目选中状态的深链接同步可以后续补充，不影响已验证的本地保存恢复流程。

视觉差异化规则见 `design-principles.md`。该工作台的画布布局不会作为所有后续工作台的固定外壳。
