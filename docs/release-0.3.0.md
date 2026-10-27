# 0.3.0 发布验收

日期：2026-10-27。新增第18–27项共10个工作台，累计 **26/55**。共同自动保存修复同步到全部26项，版本统一为0.3.0。

## 分项验收

| 新项目 | 应用测试 |
| --- | --- |
| [BlockNote](../workbenches/18-blocknote/) | 10 |
| [MDXEditor](../workbenches/19-mdxeditor/) | 9 |
| [Milkdown](../workbenches/20-milkdown/) | 8 |
| [PDF.js](../workbenches/21-pdf-js/) | 7 |
| [reveal.js](../workbenches/22-reveal-js/) | 11 |
| [Univer](../workbenches/23-univer/) | 9 |
| [Vditor](../workbenches/24-vditor/) | 10 |
| [Fabric.js](../workbenches/25-fabric-js/) | 13 |
| [Filerobot Image Editor](../workbenches/26-filerobot-image-editor/) | 11 |
| [GrapesJS](../workbenches/27-grapesjs/) | 6 |

新增应用测试合计94项；既有16项的114项测试重跑通过，合计208项。

## 统一验证

- 主仓库按1–11、18–27、51–55范围执行check/test/package：26项构建、208项应用测试、26个源包全部通过。工具测试3项通过。
- 10个子agent各用独立worktree；环境同时运行3个子agent，完成即补位。主agent审核源码、真实截图与导出证据后整合。
- 新增10项实际Chrome覆盖主要操作、导出内容、重新打开、未完成输入、延迟确认、响应丢失、离线重试/找回、冲突、375px、暗色、reduced-motion与键盘。完整记录见各项目README及忽略的.cache。
- 既有16项沿用0.2.0业务界面验收；此次共同保存代码在真实Chrome、IndexedDB及SQLite的隔离测试夹具中验证后，同步到26项并全部重建/测试/打包。
- 最终客户端9组核心回归全部通过，另补验旧缓存确认、失败重试及畸形回执。测试夹具不是Host业务调用。
- 26张真实截图的尺寸、版本和SHA-256见[截图说明](screenshots/README.md)。

## 共同保存修复

快速A→B→A撤回必须恢复已确认的状态，同时将IndexedDB中的中间稿B改回A。已确认指纹与服务端回执的阶段、消息、时间一起保留；不能根据同步校验或旧项目是否存在推断已保存。

缓存修复失败时保留待修复标记，支持手动、自动和online重试，离开页面时保护未修复内容；延迟回调按文档epoch隔离。旧缓存缺少回执时明确保持未确认状态，显式重试携原版本做乐观确认；不会把异步校验草稿误报成已保存。待重放请求保持原mutation，版本冲突继续保护另一版本。

最终客户端SHA-256：`b96ed468ebc08b93410a8693b892fc5a14aa1a48bef3a1d329628d449f8c8376`。新增初始化仍从同一蓝图复制。

## 整合修复与独立证据

- PDF.js保持模板CSP，使用JavaScript解码器并返回正确模块MIME；JPEG2000 PDF由空白恢复为准确RGB(210,30,30)，没有解码警告。
- BlockNote完整JSON文件与180,000字符文本草稿分开；600块、281,504字节实际导出可再次导入，原项目保留，Markdown仍先预览后应用。
- MDXEditor修复不支持Markdown恢复后持续initial-normalize标记导致的源码修正丢失；完整工程文件支持模型及未应用输入的往返。
- Milkdown使用同步原生视图更新捕获编辑；修复Crepe表格在下一帧派发过期选择事务的问题，保留原生表格工具。846,750字节完整工程实际往返。
- Vditor将Lute、语言、图标、样式改为同源资源；图标以外部脚本加载，资源物理目录避开导出器忽略的dist名称。长文暂缓排版，但正文和项目仍可保存导出。
- Univer独立核对公式结果、CSV值、原生JSON公式/格式/多表，并恢复未提交单元格输入。
- Fabric独立核对PNG尺寸及SVG对象类型、顺序、变换矩阵。Filerobot以Pillow核对裁剪/尺寸/像素，重新打开前后像素一致，原图下载失败时停止工程导出。
- GrapesJS未完成属性绑定组件、CSS属性与字段，失焦/刷新保留，选择其他组件不误用草稿；离线HTML/CSS是实际导出内容。
- Reveal通过实际file://打开离线HTML并翻页，导出的运行代码、CSS与许可资源经哈希核对。

## 范围

新工作台都是实际上游核心库的有界集成。BlockNote不含商业XL功能；Univer不含商业Office导入导出；图片/画布/页面编辑器支持的对象与大小见各项目说明。Vditor MIT、Lute Mulan PSL v2和主题CSS BSD-3-Clause分别保留，其他依赖和示例素材许可同样独立。

Floatboat桌面客户端实际导入仍未实测；历史Host调用记录保留，本批未重跑既有AI业务，也没有把测试响应作为模型调用成功。源包默认排除数据库、原图等预览业务数据。

