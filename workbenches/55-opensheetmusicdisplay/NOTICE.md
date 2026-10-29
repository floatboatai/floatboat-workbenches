# 第三方许可与内容来源

- [OpenSheetMusicDisplay](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay) **2.2.1**，BSD-3-Clause；使用 npm 官方发布浏览器构建（含 Cursor、TransposeCalculator），原始许可保留在 app/src/vendor/OSMD-LICENSE。[官方入门与 load/render API](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay/wiki/Getting-started)、[源项目许可](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay/blob/develop/LICENSE)。
- VexFlow **1.2.93**，MIT，由 OSMD 使用；音乐字形由上游渲染器输出为 SVG 路径，没有额外下载网络字体。
- [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) **5.11.2**，MIT。
- [JSZip](https://github.com/Stuk/jszip) **3.10.1**，上游提供 MIT 或 GPLv3 双许可，本项目使用 MIT 许可选项。
- 全部已安装生产依赖的许可汇编在 app/src/vendor/THIRD_PARTY_LICENSES.txt，保留上游第三方声明。gl 可选原生依赖被显式移除；没有分发原生渲染程序。

内置示例均由本项目录入为 MusicXML，没有下载或复制第三方乐谱或版本：
- 《Minuet in G major》BWV Anh. 114，Christian Petzold（约 1725 年，旋律属公有领域）；左手声部为本项目的简化编配，本版以 CC0 1.0 提供。
- 《Ode to Joy》，贝多芬第九交响曲 Op. 125 末乐章主题（1824 年，公有领域）；弦乐四重奏编配为本项目原创，以 CC0 1.0 提供。
- 《Morning Lines》为本项目原创练习曲，以 CC0 1.0 提供。

PDF 写入器、SHA-256 与示例记谱生成器为本项目代码，未引入新的第三方依赖。软件许可不授予用户上传乐谱的内容权利。源包不含用户上传文件、预览数据库或任何凭据。
