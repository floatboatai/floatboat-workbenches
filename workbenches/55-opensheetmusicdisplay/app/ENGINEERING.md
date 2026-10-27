# 乐谱审校工程

固定 Node 22、React 19.2.3、严格 TypeScript、官方 Vite profile。root/app 精确依赖与锁一致：opensheetmusicdisplay 2.2.1、fast-xml-parser 5.11.2、jszip 3.10.1。覆盖规则移除 OSMD 的 gl 原生可选依赖，仅使用发布的浏览器构建；没有更改 SDK、CSP 或 Vite。

## 模块与数据

- contracts/musicxml 验证 XML 语法、资源声明、深度/规模，读取 score-partwise 声部/小节索引。
- contracts/archive 在 JSZip 解压前检查 ZIP 中央目录；再用固定版本实际存在的 internalStream 接口做实际输出限额。上游类型缺少该方法，因此仅对已核实的方法作窄类型补充并运行时检查，不关闭类型检查。
- contracts/domain 验证原文件编码、XML 对应关系、显示参数、审阅位置和批注锚点；archive.verifySource 在 POST/PUT 时重新解压 MXL 核实原件与渲染 XML 一致。
- 原件 base64 和安全解析后的 XML 保存在项目 payload；限制足够小，不需要临时 blob URL 或外部路径。原件下载解码完整字节，报告记录 SHA-256。
- server/store 使用参数化 SQL，revision 防止旧窗口覆盖新版本。迁移 0002_projects.sql 保持不变，测试使用内存 SQLite。
- UI/App 管理工作流程，MeasureIndex 与 AnnotationBook 分离导航和批注；ScoreView memo 避免批注输入重建乐谱。OSMD 动态加载，关闭自动 resize，只在明确设置或文件变化后渲染。每次 load 绑定独立 DOM 容器；异步完成时检查活动状态，卸载清理自己的实例。
- SVG 导出将所有谱页按真实尺寸串接成独立 SVG，白底、音符路径保留，不依赖工作台 CSS。报告 JSON 与源文件分开导出。

## 边界与恢复

MusicXML 不是任意 XML 查看器；不加载外部 DTD、实体、图片、链接或脚本。MXL 不支持分卷/ZIP64/加密，只处理首个 rootfile；不从文件中的 URL 发起网络请求。输入必须先通过业务校验与离屏真实试渲染，才替换 React 项目状态。

所有会修改数据的控件在导入/保存/打开期间禁用。失败保留原文、批注；保存成功但列表刷新失败单独提示。空白批注不会保存，项目原件和批注在同一版本中提交。显示声部与批注声部是不同概念，批注绑定原始声部 ID + 小节序号，展示小节号单独记录，以支持弱起/重复编号。

## 验证

pnpm workbench:check → pnpm test → pnpm dev Chrome 主流程 → pnpm package。测试覆盖 XML/实体/外部资源、ZIP 路径/大小/伪报长度、原件一致性、批注锚点、报告哈希、SQLite 恢复和409冲突。浏览器覆盖真实文件与导出、刷新恢复、暗色/375px/reduced-motion、无失败资源与CSP错误。没有音频、模型或其他 Host 能力；客户端导入安装不由本地预览代替。

scripts/collect-licenses.mjs 可重新生成生产依赖许可证汇编；它是维护脚本，不参与工作台运行或自定义编译。

## 自动保存与工作草稿

新增 0003_autosave.sql，旧迁移保持不变。autosave-server 在事务中保存完整工作副本，并仅将通过业务验证的内容写入 projects；documentId/mutationId 支持丢失响应后的幂等重试。客户端串行提交、防抖、IndexedDB 回退，documentKey/loadEpoch 仅在文档切换时更新。保存返回时不覆盖期间继续输入的内容。草稿状态与正式内容状态明确区分。

音乐原件通过 verifySource 在事务之前进行异步字节对应校验；恢复器仅放宽空批注，XML/ZIP 安全和锚点检查保持。
