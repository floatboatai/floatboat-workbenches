# GrapesJS 页面构建工作台

用 GrapesJS 0.23.8 开源核心制作单页网站。原生画布支持双击文字、区块拖拽、图层选择、撤销/重做和响应式样式，工具面板保留中文标签。

![页面构建工作台](../../docs/screenshots/grapesjs.png)

## 已实现

- 工作室主页模板与 6 种可拖动/键盘添加的区块：区段、标题、正文、双栏、锚点按钮、分隔线。
- 原生图层和样式管理器，字号、字重、颜色、间距、尺寸、边框和布局；桌面、平板、手机预览。
- 页面名称、内容及未离焦的文字自动保存到 SQLite；源 JSON、当前原生属性输入与选择位置保留在工作副本。
- 断网时使用同浏览器同源 IndexedDB 副本；重连幂等重试，乐观版本冲突保留本机草稿，并提供服务器版本/恢复副本入口。
- 项目 JSON 导入创建新项目。导出项目 JSON、独立 CSS，以及包含完整 HTML/CSS、无需运行时或网络依赖的单文件网页。
- 375px 使用画布/组件与图层/样式视图；深色主题、减少动画、键盘添加区块、具名输入和可见焦点。

## 范围

这是文字与 CSS 布局组成的单页网站编辑器。支持常见布局/文字元素与页面内锚点；不包含图片、远程素材、视频、表单、脚本、插件、任意 HTML 导入、多页面、邮件客户端兼容性或网站发布。项目 JSON 是本工作台的受限格式，不接受任意 GrapesJS/Studio SDK 项目。没有 AI 功能或 Host 调用。

导入上限 700 KB、1000 个元素、24 层嵌套、1200 条样式规则。CSS 属性/函数与 HTML 元素、属性均校验；拒绝脚本、事件属性和远程资源。原生 HTML 拖入和富文本富格式粘贴关闭，粘贴保留纯文本；工具栏支持加粗、斜体、下划线、删除线。默认 CDN 图标、遥测、原生存储管理器和素材上传已关闭。

原生画布的空间拖动仍适合鼠标/触控板；窄屏和键盘可通过组件按钮与检查器编辑。离线缓存仅适用于相同预览源，端口变化、其他设备或清除浏览器数据不会迁移缓存。页面导出携带已应用模型；“恢复副本”另含未完成输入。

## 运行与安装

仓库根目录运行：

```sh
pnpm workbench prepare grapesjs
pnpm workbench check grapesjs
pnpm workbench test grapesjs
pnpm workbench dev grapesjs
pnpm workbench package grapesjs
```

也可在本目录运行 `pnpm workbench:check`、`pnpm test`、`pnpm dev`。打包后在 **Floatboat → My → Workbenches → Import workbench** 导入 `.fbworkbench`。源码包不携带预览数据库。Floatboat 桌面导入尚未实测。

## 验证

6 个领域/SQLite 测试覆盖模板及区块往返、完整导出、执行与网络输入拒绝、元素/深度限制、HTML 转义、未完成工作副本、丢失响应幂等与版本冲突。

真实 Chrome 流程覆盖文字未离焦保存并重载、原生样式/区块/设备、独立解析 JSON/HTML/CSS 导出、未完成检查器与无效源码恢复、延迟 ACK 继续输入且 iframe 实例稳定、服务端提交后丢失响应、导入新项目、跨窗口冲突与新标签恢复、离线新项目切换与找回、375px/1440px、深色/减少动画。具体结果见 `app/ENGINEERING.md`；本地浏览器脚本与结果保存在忽略的 `.cache/`。

## 来源与许可

[GrapesJS 官方仓库](https://github.com/GrapesJS/grapesjs) · [入门](https://grapesjs.com/docs/getting-started.html) · [组件模型](https://grapesjs.com/docs/modules/Components.html) · [存储管理](https://grapesjs.com/docs/modules/Storage.html) · [Canvas API](https://grapesjs.com/docs/api/canvas.html)

固定依赖 `grapesjs@0.23.8`，使用其发布的 CSS 与中文语言包。开源核心为 BSD-3-Clause；版权声明和完整许可保存在 [THIRD_PARTY_NOTICES.md](app/THIRD_PARTY_NOTICES.md)。未使用另行授权的 Studio SDK。示例页面与 CSS 几何插图为本项目原创。
