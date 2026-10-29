# 乐谱审校台 · OpenSheetMusicDisplay

当前版本：**0.9.0**。导入制谱软件导出的 MusicXML / MXL（最大 32 MB），在 OpenSheetMusicDisplay 渲染的真实谱面上逐音移动光标、回放、移调、切换声部与版式；在音符或小节上留下编号批注，批注直接画在谱面上并与右侧账本联动；导出带批注的 PDF 校样、PNG、SVG 与批注 JSON。原文件逐字节保留。

![乐谱审校台](../../docs/screenshots/opensheetmusicdisplay.png)

## 使用

在总仓库执行 `pnpm workbench prepare opensheetmusicdisplay`，进入本目录：

```sh
pnpm dev               # 打开打印出的完整地址
pnpm workbench:check
pnpm test
pnpm package
```

首开即是示例《小步舞曲 G 大调》。在谱面上点击音符定位（蓝色光标跟随），「在此添加批注」写下问题并选类别；←/→ 逐音移动光标、Shift+←/→ 逐小节、空格回放、N 添加批注。「乐谱库」菜单负责导入、示例、最近的审校、恢复草稿与删除；修改自动保存。

## 支持范围

- `.musicxml` / `.xml`（UTF-8、UTF-16 等）与 `.mxl`；原文件 ≤ 32 MB，解压后的 MusicXML ≤ 64 MB；≤ 64 声部、每声部 ≤ 5000 小节、≤ 40 万音符。标准 MusicXML DOCTYPE 可直接导入（不下载 DTD）；DTD 内部子集、实体声明、样式表处理指令被拒绝；外部图片与链接仅提示忽略。
- 版式：A4 竖版/横版分页、无限滚动、单行横卷；缩放 30–300%；移调 ±12 半音；声部显示开关；小节号、标题/作曲、声部名可切换。
- 批注：锚定声部 + 小节 + 可选拍位，7 种类别，最多 1000 条；空白批注保存为草稿。
- 导出：PDF（谱页 + 批注清单页，谱页为 JPEG 图像）、PNG（当前页）、SVG（全部页）、批注 JSON v2、原文件、MXL 展开的 MusicXML。
- 回放为 Web Audio 简单合成音色，不代表乐器音色与演奏法。

示例：Petzold《小步舞曲 G 大调》BWV Anh. 114（旋律公有领域，左手为本项目简化编配）、贝多芬《欢乐颂》主题（公有领域，本项目弦乐四重奏编配）、《Morning Lines》（本项目原创）。均由本项目录入，未复制第三方版本。

验收记录见 [app/ACCEPTANCE.md](app/ACCEPTANCE.md)，工程边界见 [app/ENGINEERING.md](app/ENGINEERING.md)，上游版本与许可见 [NOTICE.md](NOTICE.md)。`artifacts/opensheetmusicdisplay-studio-0.9.0.fbworkbench` 可通过 **Floatboat → My → Workbenches → Import workbench** 导入；客户端安装流程尚未验收。
