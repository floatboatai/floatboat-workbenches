# 乐谱审校室 · OpenSheetMusicDisplay

导入已有 MusicXML/MXL，在真实乐谱上核对声部与版式，按小节留下审校记录。原文件、显示设置、当前审阅位置和批注一起保存，刷新后可重新打开。支持导出当前谱面 SVG、原始文件、MXL 中的 MusicXML，以及带原件 SHA-256 的批注报告 JSON。

软件用于乐谱审阅，不编辑音符、不提供音频播放。内置《Morning Lines》为本项目原创双声部示例，没有复制第三方乐谱。

## 使用

在总仓库执行 `pnpm workbench prepare opensheetmusicdisplay`，进入本目录执行：

```sh
pnpm dev
pnpm workbench:check
pnpm test
pnpm package
```

打开预览命令打印的完整地址。新建或导入乐谱，选择显示声部；在小节索引中选择批注声部与小节，再添加记录、标记已核对。保存后从顶部列表重新打开。窄屏使用小节选择和“转到批注区”，谱纸在独立区域横向滚动。

`artifacts/opensheetmusicdisplay-studio-0.1.0.fbworkbench` 可通过 **Floatboat → My → Workbenches → Import workbench** 导入。源包不包含预览数据库；客户端安装流程尚未验收。

## 支持范围

- UTF-8、score-partwise MusicXML；原文件 1–200 KB，XML 内容不超过 180 KB。
- 1–12 个声部，每声部 1–200 小节，总计 1–4000 个音符或休止符；最多 100 条批注，每条 1000 字符。
- 不接受 DOCTYPE、ENTITY、外部图片/链接/脚本及样式处理指令；带外部 DTD 的文件需先在制谱软件中导出不含声明的版本。不会访问外部 DTD 或网络字体。
- MXL 使用 META-INF/container.xml 的第一个 rootfile；只支持普通非加密 ZIP（Stored/Deflate），最多 32 个条目，声明解压总量不超过 500 KB，每条目不超过 180 KB。另对实际解压流限额，拒绝路径穿越、重复条目及 ZIP64。
- SVG 对应当前显示声部、版式和比例，批注作为报告单独导出。源文件下载保留上传字节；报告是审校清单，不是完整项目备份或 MusicXML 制谱文件。

## 验收

2026-10-27：严格模板构建、10 项契约/业务/数据库测试通过。Chrome 真实 MusicXML/MXL 导入、声部筛选、版式与比例、小节批注及核对状态、保存刷新恢复、原件逐字节下载通过；无效 XML/外部声明拒绝后保留原工作，取消新建保留未保存修改。SVG 独立打开有真实音符路径，源 XML 独立打开并通过 XML 解析；报告包含原件哈希与正确小节锚点。375px、暗色、reduced-motion、键盘导航均检查。

模型与外部服务不是本应用功能，manifest 没有 llm 能力。上游版本与许可见 [NOTICE.md](NOTICE.md)，工程边界见 [app/ENGINEERING.md](app/ENGINEERING.md)。
