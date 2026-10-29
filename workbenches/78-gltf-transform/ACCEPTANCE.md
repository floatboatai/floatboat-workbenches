# 0.9.0 验收 · 模型优化流水线

功能验收：**local-verified**（本地预览 + 真实 Chrome）。结构审查：沿用 0.8.1 的模型空间结构（全幅画布、上下文工具轨、浮动检查器、按需资产库），新增右上阶段条与检查器内的技术表，见下方“结构审查”。Floatboat 客户端导入：**unverified**。

## 命令

- `node scripts/workbench.mjs check gltf-transform`：通过（仅 WORKBENCH_LARGE_MODULE 警告：App.tsx、asset.ts、共享 autosave-client.ts）。
- `node scripts/workbench.mjs test gltf-transform`：22/22 通过（`tests/asset.test.ts` 10、`tests/pipeline.test.ts` 7、`tests/import.test.ts` 5）。
- `node scripts/workbench.mjs package gltf-transform`：`gltf-transform-studio-0.9.0.fbworkbench`，63 个文件，不含业务数据。解包后 `pnpm install --frozen-lockfile --ignore-scripts --prod` 成功，`node_modules` 中无 `.node` 原生文件，functions/draco/meshopt 可在该安装中加载。

## 浏览器流程（Playwright + Chrome for Testing，GPU，全新数据目录）

1. **样例 → 流水线 → 导出**：载入风机样例；运行剪除、去重、焊接、简化（行内把保留比例改为 0.3）、重采样。阶段条 6 段；对比表 1.08 MB → 447.8 KB（−59%）、三角面 27,356 → 11,150、上传顶点 20,549 → 5,814、材质 8 → 6、关键帧 302 → 8。点“原件”“焊接”分别预览（读数随之切换）。⌘Z 撤销重采样（无需服务端）。刷新后 5 段阶段与参数草稿 “0.3” 均恢复。导出 GLB：文件头 `glTF`、2 段动画、6 个材质、464,396 B；选 Draco 再导出：JSON `extensionsUsed/Required` 含 `KHR_draco_mesh_compression`，291 KB，服务端已回读。
2. **真实输入**：`notes.txt` → “没有找到 .glb 或 .gltf 文件…”；Blender 式 `turbine.gltf + .bin + 2 张贴图` 多选导入成功；缺贴图时列出 `baseColor_1.jpg、baseColor_2.png`；带子目录的 ZIP 导入成功；Draco GLB 导入提示“Draco 几何已解码”；**22.89 MB GLB 经 24 个 1 MiB 分块上传**（单个请求体最大 1,398,145 B < SDK 的 2,000,000 B），约 1.4–2 s 完成，随后在服务端焊接（172–330 ms）。
3. **自动保存契约**：首个 POST 延迟 2.5 s 期间继续输入备注，刷新后为完整新文本；服务端提交后丢弃响应（route.fetch + abort）→ 状态“草稿已暂存本机，连接恢复后重试”，自动重试后保存，项目仍只有 1 个（同一 mutation 幂等）；节点平移 Y 输入 “5.” → 状态为草稿“平移 Y需要完整数值”，刷新后仍为 “5.”。
4. **修订**：节点 Tower 设平移/旋转（原件视图实时预览）；贴图页显示两张缩略图（JPEG 1024×1024、PNG，显存与用途），把 Blade laminate 替换为 256×256 PNG；“应用修订并更新结果”生成“修订”阶段后再剪除。动画页列出 Rotor spin / Yaw sweep（时长、通道、关键帧、目标节点），点击播放/暂停。
5. **完整工程**：导出 ZIP（project.json + 4 个资源，含替换贴图）；同一服务导入 → 新文档（项目 1 → 2）；**全新服务**导入 → “上传了 4 个资源”，阶段条与备注恢复。
6. **375×812**：空态、导入后与操作后 `scrollWidth = 375`；检查器排在画布下方，可在其中运行量化（832.4 KB → 556.0 KB）；资产库 Escape 后焦点回到“打开资产库”。
7. 每个流程 pageerror/console error 为 0；预期内的 400（无效文件、缺资源导入）与丢包演练的连接重置单独计数。截图 `docs/screenshots/gltf-transform.png` 为 1440×900 普通样例数据。

观察到的问题与处理：
- 导入完成后立即再次导入会被文档切换后的副作用取消（无提示）。已移除 documentKey 副作用中的 epoch 递增，改由各操作的 documentKey 校验处理，复测通过。
- 1440 下检查器内容超过高度时 fieldset 不收缩，导致交付区被裁出视口。fieldset 改为 `display: contents`，仅检查器正文滚动，复测通过。
- 375 下 701–1100 的 `with-inspector` 偏移覆盖了窄屏规则，提示条被挤成一列。媒体查询限定为 701–1100，复测通过。
- 细塔筒色带在 1e-3…1e8 深度范围下闪烁；相机 near/far 改为随模型尺寸。
- **未修复（共享代码）**：`autosave-client.ts` 在保存成功后不清除 `edited`，因此编辑过的文档在切换/导入时总会弹出“当前内容已恢复，但本机缓存尚未修复…”确认框（0.8.1 已存在）。确认后行为正确；该文件来自共享蓝图，留给集成方统一修复。

## 结构审查（与功能验收分开）

主任务（导入 → 逐步优化 → 对比 → 导出）全部发生在模型旁：阶段条在画布右上，优化技术表在检查器首页，导出在同一检查器底部；文件生命周期仍只在资产库。首次使用无需建工程。与 Circuit 的底部仪表台、Oasis 的纸张/文件菜单区分明确。1440 与 375 截图已审阅。限制：检查器在 1440 下需滚动才能看到全部 11 个步骤（对比表与阶段栈置顶）。

## 仍然限制

- 实例化对含动画的模型不生效（glTF Transform `instance()` 限制），步骤会说明；静态场景已测试。
- 缩小贴图只处理 PNG/JPEG；KTX2 预览为灰色占位；不内置 KTX2/WebP 编码。
- 导入合计 64 MB、规范模型 128 MB；上传会话在内存中，服务重启会丢弃未完成的上传。
- 未在 Floatboat 客户端中导入安装包（unverified）。
