# Reveal 排练桌

基于 **Reveal.js 6.0.2** 的 Markdown 演示工作台。写下一页文字，在真实舞台中排练，把完整演示带走。

![Reveal 排练桌](../../docs/screenshots/reveal-js.png)

## 可以完成的工作

- 逐页编辑 Markdown 与讲者备注，新增、复制、前后移动、删除并撤销。
- 水平页带选择页面，Reveal 原生方向键/触控/按钮导航、总览、渐进列表；进入当前窗口放映，Esc 返回编辑。
- 松绿、纸白、深蓝主题；16:9/4:3 画幅；淡入、滑动或无过渡；显示页码。减少动态模式取消动画。
- 整套 Markdown 以独立 `---` 分页，以 `Notes:` 写备注；未应用或无效源稿可恢复。
- 默认自动保存，标题、正文、备注、显示设置与未应用稿都进入工作副本。明确显示待保存、草稿、离线和冲突；可导出恢复文件并打开服务器版本。
- 导入 `.md`、项目 `.json` 或恢复文件会创建新演示；项目备份保留全部设置。
- 导出单文件 **离线 HTML**：实际 Reveal 引擎、CSS 和主题全部内嵌，无 CDN。直接打开下载文件即可播放。导出包含隐藏的讲者备注，请在分享前检查。

## 内容范围

支持标题、段落、粗体、斜体、行内代码、列表、引用和三反引号代码块。HTML、图片与链接按文字显示，不执行代码或加载远程内容。最多50页，每页4000字符正文/2000字符备注，有效项目350KB；项目/Markdown导入400KB，源稿100000字符，恢复文件5MB。

Markdown 是文本交换格式，不保存舞台设置；导出前检查分页是否可往返。若正文包含歧义分页/备注标记、未闭合围栏或源稿超限，请使用项目备份，完整保留输入。过长单页请拆页，舞台不会自动缩小到难以阅读的字号。

不提供 PDF/PPTX、纵向页面、远程媒体、自定义 HTML/JS/CSS、数学图表插件或 AI。HTML 用于放映，不是编辑导入格式。浏览器缓存限同一 origin；服务端项目通过 SQLite 保存。

## 开发与安装

在仓库根执行：

```sh
pnpm workbench prepare reveal-js
pnpm workbench check reveal-js
pnpm workbench test reveal-js
pnpm workbench dev reveal-js
pnpm workbench package reveal-js
```

也可进入本目录运行 `pnpm workbench:check`、`pnpm test`、`pnpm dev`、`pnpm run package`。使用终端打印的完整预览 URL。源码包由 **Floatboat → 我的 → 工作台 → 导入工作台** 安装；桌面实际导入尚未验证。

## 验收

编译检查与11项领域/SQLite测试通过。Chrome 已验证安全 Markdown、真实 Reveal 导航/渐进列表/窗口放映、页序操作、未应用源稿刷新恢复、输入期间延迟保存回执、提交后丢失响应的幂等重试、保存拒绝后的恢复、实际项目和 Markdown 下载再导入、实际离线 HTML 播放、冲突保护与新标签页恢复。另已验证新建离线草稿切换恢复、375px深浅色与减少动态、1440px桌面、预览重启持久化、非法JSON导入和放映焦点循环。正常流程零页面异常与失败请求；故障测试仅包含预期的自动保存网络错误。完整浏览器证据、最终截图与验收结果见 `app/ENGINEERING.md` 和本地忽略目录 `.cache/`。Host 调用与桌面导入不计入已通过项目。

## 来源和许可

- [Reveal.js 上游](https://github.com/hakimel/reveal.js)、[初始化与嵌入](https://revealjs.com/initialization/)、[React 集成](https://revealjs.com/react/)。使用固定6.0.2发布包，MIT许可保留于 `app/assets/reveal/LICENSE`，也嵌入导出的HTML。
- 使用项目既有 React19.2.3、lucide-react0.562.0 与 Floatboat SDK 模板；模板授权说明保留于 `.template-guidance/LICENSES.md`。本工作台代码授权遵循仓库现有决定。
