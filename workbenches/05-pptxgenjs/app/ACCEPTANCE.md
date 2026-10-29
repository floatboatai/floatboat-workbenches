# 演示编排室 0.9.0 验收

日期 2026-10-29。功能验收与结构审查分别记录。

## 功能验收：local-verified

### 命令

- `node scripts/workbench.mjs check pptxgenjs`：manifest、依赖、类型、构建通过；保留 3 条 `WORKBENCH_LARGE_MODULE` 提示（`domain.ts`、`DeckApp.tsx`、共享 `autosave-client.ts`）。
- `node scripts/workbench.mjs test pptxgenjs`：20/20 通过。`export.test.ts` 用真实 PptxGenJS 4.0.1 生成示例文稿并解包校验：10 张幻灯片、10 个命名版式母版、2 个图表部件（barChart、doughnutChart、内嵌 xlsx）、1 张 JPEG 媒体、16:9 `sldSz 12192000×6858000`、标题绑定 `type="title"` 占位符、超链接关系、加粗片段、6 行表格、备注文字、roundRect/rightArrow 形状、每段至多一个且位于段首的 `<a:pPr>`；4:3、隐藏页（`show="0"`）、品牌色写入母版、折线图。其余测试覆盖严格/草稿校验、0.3.0 迁移（含数据库旧行读取迁移）、版式切换、吸附与缩放、层级与复制、撤销合并、AI 大纲转换、图片格式识别、媒体库去重与上限、自动保存（未完成图表数值与缺失图片保存为草稿、幂等重试）。
- `node scripts/workbench.mjs package pptxgenjs`：`artifacts/pptxgenjs-studio-0.9.0.fbworkbench`，64 个文件，不含业务数据。

### 真实浏览器（Playwright + Chrome for Testing，空数据目录，`FLOATBOAT_HOST_MODE=offline`）

1440×900，一个连续流程 18 项检查全部通过，零控制台/页面错误：

- 首开：示例文稿、状态 idle、服务端 0 个项目；首次拖动后自动创建项目。
- 舞台：拖动正文框（吸附到版心 x=9%）→ 自动保存；方向键/Shift+方向键微移；三次 ⌘Z 回到母版位置、⇧⌘Z 重做。
- 富文本：双击标题就地编辑，选中末 3 字加粗 + 强调色，保存为 `[{"三个关键变化与"},{"下一步",color:"accent"}]`。
- 图表：插入后把单元格改成“约40” → 草稿 + 数据表报错；刷新后草稿与“约40”恢复；改为 40 → saved；切换折线、增加系列。
- 表格：插入、编辑单元格、增加行。形状：插入椭圆并写入文字。
- 图片：上传 3200×3920、15.5 MB 的 PNG → 浏览器内转为 1959×2400 JPEG（926 KB）入库；Delete 删除后 ⌘Z 恢复（修复了删除后焦点丢失导致快捷键失效）。
- 主题：森林预设 + 4:3 + 备注 → 保存；刷新后舞台比例 1.332。新增“对比”页插在当前页之后。
- 导出 PPTX：11 页、`sldSz 9144000×6858000`、3 个图表部件（含 lineChart）、2 张媒体、编辑后的表格文字与标题、备注；Python `zipfile.testzip()` 无错误。
- 项目 JSON：导出含 2 张图片 → 导入为第二个项目，内容与原文稿逐字节一致；0.3.0 旧 JSON 导入为第三个项目并提示“已从 0.3.0 格式转换”。
- 「文稿」菜单 Escape 关闭且焦点回到按钮；从最近文稿打开另一文稿。放映：方向键翻页、Esc 退出。
- AI 离线：`/api/app` 为 not-connected，面板显示状态卡，「生成候选大纲」禁用，「重新检测」可用，无 503 请求。

自动保存契约（单独脚本）：

- 拦截第一次保存 3 秒，期间 phase=saving、备注仍可编辑并继续输入；最终保存与刷新后均为较新文本。
- 服务端提交后中止回包 → offline → ⌘S 重试 → saved，项目数 1→1、revision 3→4（1 条预期的 `net::ERR_FAILED`）。
- 标题字体清空 → draft，正式模型字体不变；刷新后空字体草稿恢复；导出提示“还有未完成的内容，暂不能导出：标题字体不能为空。”；修复后 saved。

375×812：无横向溢出（缩略轨在自身容器内横向滚动）；缩略轨在舞台上方横排，插入条横向滚动，检查器在舞台下方；文稿菜单全宽；选择图表后数据表可编辑。

导出文件的第三方渲染：macOS 快速查看（Apple OfficeImport）打开导出的 PPTX，10 页的文字、母版装饰、表格、图片、形状与舞台一致；快速查看不渲染图表对象（用 PptxGenJS 最小图表示例文件复现同样结果），图表以 XML 结构测试验证。未在 Microsoft PowerPoint 中打开验证。

### 真实 Host 调用（本机 Floatboat 已连接，单独记录）

- `/api/app` 为 connected。第一次生成在 Host 端返回 `LLM_REQUEST_FAILED`（界面给出可读错误，现已附带 Host 错误码）；稍后重试成功：3.3 秒返回 7 页候选稿，采用前页面不变，刷新后候选稿保留，采用后替换为 7 页且主题保持，自动保存 saved，零控制台错误。

### Web Interface Guidelines

2026-10-29 从官方源获取后复核改动源码：图标按钮命名、表单标签/name/autocomplete、可见焦点、跳转链接、菜单 Escape 与焦点返回、`role=status`/`alert`、`theme-color` 与 `color-scheme`、`overscroll-behavior: contain`、`touch-action: manipulation`、拖动时禁止选中文字、占位符省略号、数字 tabular、日期/数字使用 `toLocaleString`、删除页确认与撤销、reduced-motion、图片宽高属性。富文本编辑器拦截粘贴仅为转为纯文本插入（不阻止粘贴）。

### 限制

- 舞台图表为 SVG 近似；PowerPoint 自动坐标轴刻度可能不同。
- 不支持动画、视频、PPTX 反向导入、多选、旋转、表格合并单元格。
- 被移动的占位文本导出为普通文本框，PowerPoint 编辑视图会显示该母版空占位的提示（放映不可见）。
- 本地恢复依赖同源 IndexedDB；不同预览端口不共享。
- Floatboat 客户端导入源包**未验收**。

## 结构审查：pass（待主代理整合确认）

- 主任务：舞台在中间占主区，缩略轨（168px）与上下文检查器（304px）分列两侧，插入工具贴在舞台上沿、演讲备注贴在舞台下沿；旧的“项目选择器 + 新建/删除文稿”页头与“立即保存/导入/导出/生成大纲”按钮排已删除。
- 文件生命周期：全部进入「文稿」菜单（新建空白/示例、导入/导出项目 JSON、立即保存、恢复草稿、最近文稿、删除）；自动保存状态为名称旁小字。
- 主业务动作：「导出 PPTX」是唯一实色按钮；AI 大纲为次要按钮并带离线状态卡；图表数据表、表格网格、文字格式都在被选对象的检查器中。
- 对照：Mermaid 0.9.0（`docs/screenshots/mermaid.png`）为源码 IDE 双窗，CircuitJS 0.8.1（`docs/screenshots/circuitjs.png`）为画布 + 菜单；演示编排室采用同类“文件菜单”入口，但主区是带母版的多页舞台 + 缩略轨，选择驱动检查器。
- 空态与有内容：示例文稿、空白文稿（单页标题版式）、空图框“双击插入图片”、空占位提示均可直接编辑；375px 保留同一入口顺序。
- 截图：`docs/screenshots/pptxgenjs.png`（1440×900，空数据目录首开示例文稿，第 3 页图表选中）。
