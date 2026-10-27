# Reveal 排练桌工程说明

## 模块与运行

- `src/contracts/deck.ts`：结构校验、体积限制、受限 Markdown 渲染、整稿分页、可移植源稿检查、项目/恢复文件导入与页序操作。所有来自文件/HTTP/恢复缓存的数据从 unknown 校验。
- `src/contracts/theme.ts`：嵌入舞台与导出共用的系统字体主题。三套配色无需字体、图片或 CDN。
- `src/ui/Stage.tsx`：一个挂载周期一个 Reveal 实例。Reveal 拥有 slides 子树，正文更新只替换受限 HTML 并 sync；project documentKey 变化才重建。保存回执不重新挂载。ResizeObserver 更新布局，卸载销毁；初始化错误可见。
- Reveal 嵌入配置使用 `embedded:true`、`keyboardCondition:'focused'`。v6 的公开 API 不暴露 focus controller；焦点进入/离开时派发本地 pointerdown 给其原生 focus controller，使 Tab 与鼠标同样隔离方向键。输入区不会翻页。禁用 postMessage API、外部插件与自动滚动视图。
- `src/ui/App.tsx`：水平页带、舞台与播放、导入/导出编排；窗口放映的焦点循环与 Escape 返回、滚动恢复。`SlideEditor.tsx` 管理正文、备注和整稿草稿；`DeckSettings.tsx` 管理显示设置，`FileTools.tsx` 提供项目/备份操作。源稿变更直接进 draft.extra，不在保存响应后重设。
- `src/ui/autosave-*`、`workspace.tsx`：仓库既有自动保存协议，storageKey=`reveal-desk-v1`。工作副本包含模型、标题、selected、source、sourceOpen。待应用稿与已应用模型分别说明；无 AI 路由或调用。
- `src/server/routes.ts`：项目列表/详情/带版本删除、自动保存、离线 HTML 生成。`store.ts` 使用参数化 SQLite，既有 0001–0003 迁移不变。
- `src/server/export.ts`：服务端校验后，将实际 Reveal UMD/CSS 和 MIT 授权内嵌到单 HTML；正文、备注、标题均转义。导出 CSP 禁止网络、表单、对象，允许内嵌固定脚本/样式。预览 SDK 的 CSP 没有修改。

## 资源和容量

`assets/reveal/runtime/reveal.js`、`reveal.css` 来自 npm `reveal.js@6.0.2` 的发布产物；LICENSE 原样保留。通过 manifest 的 `reveal-runtime` 项目资源定位，不使用工作目录、绝对路径或 `dist` 资源子目录。其上游发布目录的名称只存在于来源说明。根和 app 两套依赖/lock 同步固定版本。

最多50页；每页正文4000字符、备注2000字符；有效模型 JSON≤350000 UTF-8 字节，项目文件≤400000字节；源稿≤100000字符。逐页输入超过有效模型总容量时，保存完整草稿而不覆盖模型，restoreDeck 仍校验每页结构/边界以恢复输入。最坏文字工作副本加整稿低于自动保存1.95MB/HTTP2MB边界。恢复文件限5MB（含已确认版本和待重试副本），恢复时只取结构校验后的 snapshot，不重放旧 mutation。

项目备份可无损往返所有受支持输入与设置。Markdown 仅承载正文和备注，不含显示设置；导出先做分页/围栏往返检查，100000字符上限或歧义内容要求改用项目备份，不产生无法重新导入的 Markdown。导入用 await replace，新建文档且保留原项目。禁止将整份项目 JSON 写进源稿 draft。

安全 Markdown 只生成标题、段落、列表、引用、强调与代码元素。用户 HTML 和 URL 字符全部转义；没有可执行 HTML、远程媒体、自定义插件/CSS、Markdown HTML 属性扩展。内容过多可能超出单页舞台；用户应拆页并排练。空白页有可见编辑提示。

## 验证与边界

`pnpm workbench:check`；`pnpm test`。11项 Node 测试覆盖安全渲染、界限、分页/代码围栏、最大导入导出体积、超量草稿恢复、排序、真实嵌入引擎与授权、SQLite 幂等保存/无效草稿/冲突/导入新项目。

Chrome 脚本与输出保存在忽略的 `.cache/`：真实服务与SQLite；并非接口模拟成功。自动保存故障测试只拦截指定 HTTP 响应，失去响应测试在服务端提交后中断返回；离线播放器通过 `file://` 打开实际下载的 HTML。

Host capabilities 为空，完全本地工作流，不调用模型或其他 Host API。启动器报告连接状态不能当作 Host 业务调用证据。Floatboat 桌面导入仍未验证。本地缓存只对相同浏览器 origin 生效，端口变化不能恢复旧端口缓存；服务器项目不受此限制。SDK 共享 autosave-client 的大模块提示保留，不改公共底座。

2026-10-27 本地验收记录：11/11领域测试、编译与源码打包通过。Chrome主流程17项全通过，另外完成SQLite预览重启、非法JSON导入、原生总览选页、放映Tab焦点循环、1440×1120截图及深色桌面/375px浅色布局6项检查。正常流程零页面异常、零失败请求；故障注入仅产生预期的5条控制台网络错误（一次413、四次中断）。截图为普通示例数据且状态为已自动保存，路径 `docs/screenshots/reveal-js.png`，SHA256 `807efc9c76a622c737fc1a20343213dba23ef3f29f2b97fa5bdcc5257dcda339`。包内检查确认固定引擎、CSS和许可证均已转移至声明的项目资源。
