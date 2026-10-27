# Vditor 文章工作台

围绕一篇文章组织的中文 Markdown 写作桌：原生三种编辑模式、章节大纲、署名与摘要、书稿/发布稿排版，以及持续自动保存。

![Vditor 文章工作台](../../docs/screenshots/vditor.png)

## 可以做什么

- 在所见即所得、即时渲染和源码分屏中直接写作，使用 Vditor 的标题、强调、列表、任务、引用、链接、代码与表格工具。
- 编辑时自动保存完整工作副本；保存回执不重建编辑器。未闭合 Markdown、空标题和导入框草稿可以恢复。离线保留同源本机草稿；冲突提供导出恢复稿及打开服务器版本。
- 导入 Markdown/HTML/完整项目 JSON，始终新建文章。导出 Markdown 原文、内联样式的离线 HTML、可往返的完整项目。
- 使用作者、摘要和两种排版检查文章。支持窄屏、暗色及减少动态效果。

## 运行与安装

在仓库根目录：

```sh
pnpm workbench prepare vditor
pnpm workbench check vditor
pnpm workbench test vditor
pnpm workbench preview vditor
pnpm workbench package vditor
```

也可进入本目录运行 `pnpm workbench:check`、`pnpm test`、`pnpm dev`、`pnpm run package`。源码包在 **Floatboat → My → Workbenches → Import workbench** 导入；首次安装按客户端提示安装依赖。桌面客户端实际导入尚未验证。

## 内容边界

文章正文最多 100,000 字符，超限至 200,000 字符仅作为待缩短草稿保存；项目文件最多 900 KB，文本粘贴区最多 100,000 字符。较大的完整项目通过文件导入；最大合法项目可自导出再导入。完整项目保留正文、元数据、模式与版式；恢复草稿另外携带未完成输入。

核心范围是文字文章。图表、公式和代码以原文显示，不加载可选渲染器。原始 HTML、图片语法、块公式保留在源码模式；HTML 文件导入提取安全正文和常用格式，不保留媒体、脚本或样式。不提供文件上传、远程图片、AI、协作编辑或跨设备本机恢复。查看 [需求](app/REQUIREMENTS.md)、[设计](app/DESIGN.md) 与 [工程说明](app/ENGINEERING.md)。

## 验证与来源

类型/构建与 10 项领域测试通过。Chrome 实测三模式输入、格式、导入新文章、三个真实导出文件、无效输入恢复、延迟确认、响应丢失后的幂等重试、冲突、本机离线恢复；1440px 与 375px、暗色、减少动态效果和页面无溢出。源码包不含预览数据或凭据。

- [Vditor 官方源码与文档](https://github.com/Vanessa219/vditor)：**4.0.1，MIT**。
- [Lute 1.7.6](https://github.com/88250/lute/tree/v1.7.6)：**Mulan PSL v2**，版本来自随包 JS。
- [highlight.js](https://github.com/highlightjs/highlight.js)：仅本地 GitHub CSS，**BSD-3-Clause**；不执行高亮 JS。
- 声明资源、保留许可证及同源路由见 [资源说明](app/assets/vditor/NOTICE.md)。SDK CSP 保持原样；不调用默认 CDN。

排版预算：正文超过 50,000 字符或单行超过 4,000 字符时，自动使用原生源码编辑并暂停即时预览、阅读排版与 HTML 导出，避免上游解析阻塞输入。Markdown 与完整项目的 100,000 字符保存/往返能力不变；缩短后可恢复三模式。切换富文本时遵循 Vditor 原生 Markdown 规范化。
