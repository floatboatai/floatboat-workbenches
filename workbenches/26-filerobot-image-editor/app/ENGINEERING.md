# 实现记录

## 引擎与入口

React 19.2.3 + react-filerobot-image-editor 5.0.0-beta.159（上游 latest，明确要求 React >=19）+ react-konva 19.0.7 + Konva 9.3.18 + styled-components 6.6.0。固定版本与两份锁文件同步。使用真实 React 组件和原生工具，没有自制图像编辑器。独立 React 子树初次创建后保持引用稳定，回调通过 ref 读取当前工作副本。

`PhotoEditor.tsx` 把 onModify 的完整运行态裁为显式 design keys。上游回调包含函数、Konva 节点、原图元素和历史，不可直接 JSON.stringify；用 Konva.Filters 函数身份映射内置滤镜名（production minification 会破坏 Function.name），自定义滤镜用 filterName/finetuneName。自动保存不调用同步光栅导出。getCurrentImgDataFnRef 仅在用户导出图像时调用，pixelRatio=1，浏览器 canvas.toBlob 生成真实 PNG/JPEG。

上游临时文字在 dismissHistory 状态不会调用 onModify；监听同版本 fie-annotation-edit，保存 tmpText 格式化数组到工作副本 extra，重开时映射到恢复的文字。原生输入通过事件捕获后 microtask 保存，以免打断 React 原生 onChange；完整原始字段值留在工作副本中；重开后仅回放空值/未完成数字，已完成值由恢复模型生成，避免过期输入覆盖撤销后的编辑。工具索引只作为草稿记录；初始固定 Adjust，因为上游 Filters 在 originalSource 尚未加载时直接读 width 会崩溃。系统字体和禁用 backend translations 避免任何运行时 CDN 请求。

## 持久化与边界

复用完整 autosave SQLite/IndexedDB 协议，storageKey=filerobot-image-editor-v1。documentKey 只随文档切换变化。模型是版本号、Source 元数据、可编辑 design、备注；原图不进入自动保存快照。

`images.ts` 验证 PNG/JPEG 签名与尺寸，以 SHA-256 命名原图文件，存入 manifest originals data resource。已有内容按 hash/size 复用；新文件临时写入后原子 rename。资源路径仅接受固定 64 位十六进制 ID。图片导出工程通过 SDK page.fetch 校验状态、字节长度和 SHA-256；导入先浏览器 decode，再服务端校验原图，与工程 hash 比对，await replace 创建新工程。

API request 保持官方 2 MB 限额；上传 JSON base64 最多约 1.34 MB，模型/草稿低于共享 900 KB/1.8 MB 限额。无新增 Host capability、远端 API、凭据或 Node UI import。原图文件随工作台数据保存，删除工程不立即回收共享原图，以免破坏其他工程；需要资源清理时应另做引用扫描。

## 验证

`pnpm workbench:check`、`pnpm test`；真实 Chrome 的主流程、原生控件、恢复、工程导出导入、错误反馈、延迟 ACK、丢失响应重试、冲突、窄屏、焦点及减少动态效果。脚本与机器结果位于忽略的 `.cache/`。本地 HTTP/SQLite 是真实调用；没有 AI/Host 能力调用。Floatboat 桌面导入单独标为未验证。

验证证据：11 个领域/持久化测试；.cache/acceptance-result.json、recovery-result.json、final-result.json、pixels.json。PNG 600×400 与裁剪 PNG 800×800 跨重开逐像素相同；JPEG 解码为 600×400。最终截图1440×960，移动端375×812；故障注入之外无页面错误或外部资源请求。
