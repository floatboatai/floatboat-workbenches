# SimpleMindMap 思绪地图

0.6.0 · local-verified · [SimpleMindMap](https://github.com/wanglin2/mind-map) 0.14.0-fix.3 / MIT

以导图为主屏，用原生节点编辑、子/同级节点、删除与撤销、分支导航和展开/收起组织想法。提供思维导图、向右展开、组织结构三种布局，以及通过原生主题 API 定义的花园、墨色、莓紫主题。

原位文字尚未结束、上下文文字未应用、无效 JSON 都保留在自动保存工作稿中。恢复稿与工程导入生成新副本；原生节点 JSON 可往返，SVG 可独立解析与显示。文件抽屉和上下文工具按需使用。

![SimpleMindMap 思绪地图](../../docs/screenshots/simplemindmap.png)

运行：根目录 `pnpm workbench prepare simplemindmap`；本目录 `pnpm workbench:check`、`pnpm test`、`pnpm dev -- --no-watch`。`pnpm package` 生成 `artifacts/simplemindmap-studio-0.6.0.fbworkbench`。Floatboat → My → Workbenches → Import workbench；hostImport=unverified。

只接受纯文本节点树和本工作台工程；不支持富文本、图片、超链接、插件节点、自定义样式或带主题/视图配置的上游完整文件，拒绝时保留原始 JSON。不是独立桌面客户端或商业插件的完整移植。最多 300 正式节点，每节点 4000 字符。快速转场若共享保存协议仍在修复本机缓存，会提示确认。

详细证据见 [ACCEPTANCE.md](ACCEPTANCE.md) 和 [acceptance-evidence.json](acceptance-evidence.json)。
