# Graphify 集成

- `contracts/extract/`：同构（浏览器与 Node）确定性抽取。`builder.ts` 统一节点/关系构造（Graphify 字段、确定性编号、同对同关系合并计权）与保留偏移的注释/字符串扫描；`code.ts` 两遍处理（定义与导入 → 跨文件导入、继承、调用解析）；`docs.ts` 标题层级、链接、提及、术语与共现；`index.ts` 汇总并调用社区检测。示例资料集由同一抽取器得到同一内容地址，浏览器首屏不请求网络。
- `contracts/community.ts`：多层 Louvain（mulberry32 固定种子打乱顺序）+ 不连通社区拆分，按规模编号；`analysis.ts` 社区摘要/自动命名、核心节点、意外关联、缺社区时补齐、重新抽取后的命名迁移。
- `contracts/exporters.ts`：graph.json（`graph.community_labels`）、GraphML（按值类型声明 key，XML 非法字符剔除）、HTML 报告（内嵌 SVG + 数据 JSON，`<`、U+2028/2029 转义，无外部资源）、Markdown 报告。
- 存储：`migrations/0004_blobs.sql` 内容地址库（SHA-256，`contracts/hash.ts` 同步实现与 `node:crypto` 一致）。原文与图谱不进项目 payload，项目只存 `graph.hash` 与资料清单，避开运行时 2 MB 请求与 900 KB 项目上限；浏览器分片（每片 28 万字符）上传，服务端校验地址后入库。读取时声明 `?as=graph|text`，同一内容可同时作为原文与图谱。自动保存 `verify` 检查图谱引用存在，否则保存为草稿。
- 服务端：`/api/extract` 读取内容库原文抽取（同时最多 2 个），`/api/graphs` 规范化导入的 graph.json，`/api/search` 原文逐行检索，`/api/engine` 与 `graphify-service.ts` 检查可选 Python 服务（`multiFile` 标识、ECONNREFUSED 等原因、启动命令），`/api/enhance` 经 `app.host.llm.generateObject`（JSON Schema）命名社区，只接受请求中的社区编号。启动时 `legacy.ts` 把 0.5 版内嵌图谱的项目、草稿与回执迁移为内容地址引用。
- `service/server.py`：保留单文件接口，新增 `files: [{path, code}]` 多文件集合（路径不得越出临时根、只收代码后缀、16 MB、110 秒），`source_file` 去掉临时根前缀，`/health` 带 `multiFile: true`。
- 界面：`useGraphDesk.ts` 业务状态；`layout.ts` d3-force（社区中心黄金角排列、固定节点 fx/fy、≤400 节点同步算完，更大分帧）；`GraphCanvas.tsx` Canvas 渲染 + d3-quadtree 命中、拖动固定、键盘方向导航；`Sidebar`/`Inspector`/`FileMenu`。共享 `autosave-client/cache/server` 保持仓库实现；`storageKey` 改为 `graphify-map-v2`（0.5 版浏览器本机缓存不再读取，服务器端旧数据由启动迁移处理）。
- 运行 `pnpm workbench:check`、`pnpm test`、`pnpm package`；Python 测试用真实 graphifyy 0.9.97。


## 并发与恢复边界

- 图谱与原文可共用 SHA-256 地址；`data.ts` 的 in-flight 请求按 `graph:<hash>` / `text:<hash>` 分开去重，避免并发读取时混淆返回类型。下载时只计算选中的导出格式。
- 文档切换通过 `documentKey` 隔离抽取、检索与 JSON 应用响应；切换时清理进度、上次抽取信息和 JSON 弹窗。搜索框在切换期间停止接受输入。全文检索还使用请求序号，后发请求优先。
- JSON 应用有独立的进行中状态，输入仍可继续修改。回执仅清除提交时的同一草稿，后续输入保留；图谱已变化时不采用旧 JSON 回执。粘贴抽取仅清除内容和文件名均未改变的那份输入。模型命名核对文档和图谱地址，再合并人工命名。
- 完整项目导出携带内容库文件；共享恢复稿只保存引用，导入同一内容库可恢复，在另一台设备需要完整项目。内容库目前不自动回收孤立 blob，删除地图不会立即删除共享原文。
- 0.5 服务器项目/草稿迁移保持原迁移文件不变。旧浏览器 storageKey 缓存不自动迁移，升级前应在旧版导出未同步工作稿。

## 验证与交付

本轮使用 Node 22.23.4、pnpm 10.22.0、本机 Google Chrome 156.0.8078.73；Python 3.12 环境直接运行锁定的 graphifyy 0.9.97。应用测试覆盖抽取/社区/图谱校验/导入导出/内容库/迁移/草稿与模拟 Host，服务测试不执行被导入的代码。

浏览器验收在 archive 内的独立 SQLite 目录运行编译后的实际服务，`hostConnection: null`，不经过自动发现 Host 的开发 launcher。端口由操作系统首次分配，后续重启复用同一端口；浏览器拦截外部网络和模型提交。新增缓存并发回归对实际 `data.ts` 构建产物执行，用本机请求桩隔离网络。

`pnpm workbench:check` 的三个 `WORKBENCH_LARGE_MODULE` 提示涉及 `extract/code.ts`、`autosave-client.ts`、`useGraphDesk.ts`；检查未禁用。共享自动保存文件保持原实现。模板、SDK、构建物和本机业务数据均不提交。验收记录与结构审查见 `ACCEPTANCE.md` / `DESIGN.md`。

发布前必须先完成 REQUIREMENTS / DESIGN / ENGINEERING，再运行 `pnpm package`。旧同版本包移至 archive，不覆盖；检查 zip CRC、包内每个源码/资源字节与最终 app 一致，manifest resources 仅允许模板的正常规范化。打包通过不等于 Floatboat 客户端安装验证。

包内 `sample-corpus` 资源保留原始示例文件；示例一致性测试从 manifest 查找资源路径，因此模板将资源移入 workbench-assets 后仍可执行。`acceptance-guide` 同样随包提供。
