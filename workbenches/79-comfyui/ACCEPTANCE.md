# 0.9.0 验收 · ComfyUI 节点工作流编辑与运行

功能验收：**local-verified**（本地预览 + 真实 Chrome，对接按官方 API 行为编写的模拟 ComfyUI 服务）。
**真实生成：UNVERIFIED**——没有连接过带模型的真实 ComfyUI 做出图；也未在 Floatboat 客户端导入（unverified）。
结构审查：与功能验收分开，见下。

## 验证层级（分开记录）

| 层级 | 结果 |
| --- | --- |
| 本地验收（模拟服务 + 真实浏览器） | 通过，见下 |
| 真实 ComfyUI 服务协议对照 | 用一台真实 ComfyUI **v0.43.0**（CPU、无模型）观察协议并对照模拟服务：消息顺序、错误体、缓存行为、`progress_state`、Origin 403。节点定义快照即取自它的 `/object_info`。**没有用它真实出图**（无权重） |
| 真实生成（模型 + 采样） | **未验证** |
| Floatboat 客户端导入安装包 | 未验证 |

## 命令

- `node scripts/workbench.mjs check comfyui`：通过（仅 WORKBENCH_LARGE_MODULE 警告：App.tsx、editor.ts、nodes.ts、comfy-session.ts、共享 autosave-client.ts）。
- `node scripts/workbench.mjs test comfyui`：24/24 通过——`tests/formats.test.ts` 12（PNG 文本块 tEXt/zTXt/iTXt、转换含绕过/静音/Reroute/Primitive、校验、服务端错误映射、UI/API/PNG 导入与导出幂等、未知节点保留、模板）、`tests/session.test.ts` 9（模拟服务错误体、WebSocket 消息顺序与缓存、Origin/令牌、不可达提示、完整运行与产物、node_errors 路由、运行时错误/取消/中断、上传、容量上限）、`tests/snapshot.test.ts` 3（内置快照、6 个模板逐个构建/校验/导出/往返、6 个模板逐个在模拟服务上运行出图）。
- `node scripts/workbench.mjs package comfyui`：见 acceptance-evidence.json。`pnpm install --frozen-lockfile` 在根与 `app/` 均通过。

## 浏览器流程（Playwright + Chrome for Testing，每组全新数据目录，对接模拟服务）

1. **无服务首开**：直接显示完整 SDXL 图（7 节点 9 连线 2 分组），校验通过，连接芯片“未连接”；改 KSampler steps → 自动保存“已自动保存”，项目 1 个；刷新后值保留。双击画布搜索添加节点，Ctrl+Z 撤销/Ctrl+Shift+Z 重做；断开 negative → 芯片“1 个错误”，问题列表“缺少必填输入 negative（CONDITIONING）”并可定位；导出界面工作流 JSON（`version 0.4`、nodes/links）与 API JSON（steps=31、断开的输入被省略）。
2. **连接与运行**：检查连接后节点库换成服务的 207 个节点（含自定义 “Mock Stamp”）；运行 → 画布顶部进度卡“KSampler · 6/25”，节点琥珀描边；完成后印样带出现“完成”，Save Image 节点内显示结果图；种子按“随机”前进；详情显示精确种子、模型、步数/CFG、采样器、尺寸、正反向提示；PNG 下载含 `workflow` 与 `prompt`，ZIP 含 workflow.json、prompt.json、images/；刷新后运行与图库恢复；导入该 PNG → 新文稿（项目 1→2），种子与运行时一致。
3. **失败状态**：本地校验通过但服务端拒绝（模型列表过期）→ 问题列表标注“服务端”，节点标红，不产生运行记录；运行时错误 → 印样格“出错”，运行面板与节点指向 `VAEDecode #8`；不可达地址 → “无法连接 … 启动 ComfyUI：python main.py --listen 127.0.0.1 --port 8188”，没有原始 fetch 错误。
4. **自动保存契约**：首个保存请求被延迟 2.5 s 期间继续修改，服务端最终是较新的值；服务端已提交但响应丢失 → 仍只有 1 个项目，重试后保存新值，状态回到“已自动保存”；导入对话框里未完成的 JSON 刷新后原样恢复，点击导入给出错误且不改变文稿；有效 API JSON 导入 → 新文稿，旧文稿保留并可从菜单“最近打开”重新打开。
5. **编辑能力**：库中点击/拖放添加；复制粘贴；Ctrl+B 绕过；Alt+C 折叠；Ctrl+G 成组；从 LATENT 输出拖到空白处 → 搜索按类型筛选并在选中后自动连线；Primitive 接到 steps 后继承 INT 类型与值，API 导出把 Primitive 解析为 steps=77 且不输出该节点；静音节点在 API 导出中被省略；LoadImage 上传图片 → 服务端收到、节点值改为 `photo.png`。
6. **运行对比与复现**：3 次运行 → 勾选 3 张进入对比，不同的种子标为琥珀色；“载入这次的工作流”创建新文稿且种子与该次运行完全一致，旧文稿保留。
7. **375×760**：`scrollWidth = 375`，菜单、运行按钮、三标签可达；运行标签含连接、进度；图库标签含印样、大图与参数表；菜单 Escape 关闭并把焦点还给触发按钮；工具条打开节点搜索。
8. 各流程 pageerror 为 0；console error 仅有预期的：不可达地址的 502、丢包演练中人为 abort 的请求、测试自己的跨源探测（CSP）与 LoadImage 默认 `example.png` 在模拟服务上不存在的 404。

截图：`docs/screenshots/comfyui.png`（1440×900，SDXL 样例，3 次已完成运行）。

## 验收中发现并修复的问题

- 服务端返回已规范化的节点定义而页面再次规范化，连接后所有节点参数消失：改为服务端回传原始 `/object_info`，页面解析。
- 服务端在 `POST /prompt` 返回前就已发来 `execution_start` 等消息（真实服务也如此），早到的消息会丢失：按 prompt_id 暂存并在登记后重放。
- 缓存命中的运行在两次慢轮询之间结束，印样一直显示“运行”：提交后进入 8 s 快速轮询并立即唤醒。
- 页面 CSP 禁止 `blob:` 图片：产物改为 data URL。
- 程序化断开连线没有指针事件，改动没有进入自动保存：增加对画布版本号的轮询。
- litegraph 在两次点击时间戳相同时漏掉双击：以原生 `dblclick` 兜底（12/12）。
- 真实服务 `queue_pending` 为堆序而非按序：按编号排序。

## 结构审查（与功能验收分开）

主对象是节点图：画布占 1440×900 的主要面积（约 892×704），节点库、检查器可收起；文件生命周期在左上角“工作流”菜单（新建、模板、最近打开、导入/导出、删除），不暴露 projects；运行按钮在顶部条右侧紧邻连接芯片，进度在画布上方浮出，结果在底部印样带。与 glTF Transform（浅色模型陈列 + 材质带 + 浮动检查器）和 Bruno（集合树 + 请求/响应三栏）不同：主区是可缩放的图而非预览或表单，底部带是“按运行生成的结果”而非资产或控制台，检查器与运行面板共用右侧浮层。375px：画布 / 运行 / 图库三标签，节点库改为就地搜索。状态：**passed-with-limitations**。

限制：
- 窄屏没有检查器与小地图；复杂连线编辑不是窄屏目标（可在画布上直接点节点参数）。
- 1440 下首屏图缩放到约 0.5，文字偏小，需放大查看；节点库展开时画布约占 62% 宽度。
- 总进度条按节点数估计，采样节点的步数进度并入其中。

## 仍然限制

- **真实生成未验证**；模型权重许可由用户自行核查。
- 子图原样保留但不展开转换；WebP/FLAC 元数据导入未支持。
- 工作流 JSON > 880 KB 不能作为一个文稿保存；单图 ≤ 32 MB，每文稿 ≤ 60 次运行 / 256 MB（超出淘汰最旧）。
- 上传限 PNG/JPEG/WebP/GIF/BMP，≤ 25 MB；上传会话在内存。
- LoadImage 预览与连接后的图片预览会在连接状态下向用户自己的服务读取 `/view`（只读）；其余网络访问仅在点击“检查连接”“运行”“取消”等时发生。
- `@comfyorg/litegraph` 0.17.2 已被 npm 标记弃用，固定使用。
- 共享 `autosave-client.ts` 的已知问题（保存成功后切换文档仍可能弹出“本机缓存尚未修复”确认）未触及，按约定忽略。
