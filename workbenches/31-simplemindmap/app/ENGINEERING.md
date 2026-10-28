# Engineering

模板 3b55d46f7ae25e939ce3299073c37ed334d69c02；React 19.2.3；simple-mind-map 0.14.0-fix.3 / MIT。使用模块核心入口，未注册 RichText、Export、协作、公式、XMind/PDF 或远程资产插件。无 SDK/CSP 改动，capabilities=[]。npm 包 types 声明指向未随包发布的目录，`ui/native.d.ts` 仅按该版本源码声明实际使用的方法，无 any 或编译屏蔽。

`contracts/mindmap.ts` 分别执行 wire 恢复与正式模型验证；恢复保留原值及未支持字段，正式验证不把无效输入清理为有效。纯文本可以包含 HTML 字样，原生 TextEdit 使用 htmlEscape；富文本/图像/链接属性不能进入已验证引擎。原生 smmVersion、inserting、richText:false 等序列化字段保留。节点 JSON 只承担原生树格式，工程格式额外保存布局、主题与 extra 草稿。

`ui/MindCanvas.tsx` 拥有原生实例与生命周期；`App.tsx` 负责项目与用户输入，原生 data_change 写入模型，node_text_edit_change 写入 extra.nativeEditing，context textarea 写入 extra.nodeTexts，源码写入 extra.json。loading 完成后才挂载原生实例，防止初始化 render 回调抢占已保存恢复稿。事件和文档切换通过卸载 disposed guard 隔离；尺寸观察同时覆盖画布与 body，滚动和导航/fit/导出前刷新原生 elRect，避免文件抽屉移动画布后使用旧坐标；external data 仅在 JSON wire 不同于最新原生树时更新，避免每次保存重置焦点。

原位 flush 在同步转场锁之前完成，所有 await leave 都在 transitionRef=true 之后；锁定时实例只读，正常后台保存仍可编辑。SVG 在点击时锁定编辑/转场并等待原生 render callback，随后使用 getSvgData，克隆后取 svgHTML 并释放克隆；无 blob 图片、无 CDN 或外部导出服务。项目文件与恢复稿保留全部草稿，客户端 `download` 使用 blob 下载链接而非图片源。

SQLite/IndexedDB、幂等 mutationId、乐观 revision 与恢复回执沿用拷贝的 autosave 蓝图；未修改共享底座。源包只含源码/锁/许可证，不包含项目数据。

验证：pnpm workbench:check、pnpm test、真实 Chrome 主流程及故障矩阵、pnpm package、ZIP CRC/源码/asset对应。平台连接探测不视为客户端导入验收。
