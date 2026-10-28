# 0.6.0 local acceptance

2026-10-28，固定模板 3b55d46f7ae25e939ce3299073c37ed334d69c02，真实 Chrome channel=chrome / Playwright。最终预览 http://127.0.0.1:50345/。Host 连接探测成功，但无平台能力调用，客户端导入未验证。

- `pnpm workbench:check` 通过，唯一诊断为 autosave-client / App 体积建议，不影响类型/构建；`pnpm test` 10/10。
- 原生文字创建/属性、画布拖动、Transformer 控制点缩放（390→436.59）、旋转、图层顺序、PNG 原图写入/读取均有浏览器结果。
- 画布绘制超过 8 万非白像素；导出 PNG 经 Chrome Image.decode 解码为 1000×640，145164 非白像素。完整工程原图 base64 字节往返一致。
- 刷新恢复 JSON `{ unfinished` 与坐标 `-`。实际 exportDraft 的 cacheValue.snapshot 导入产生新 documentId，保留全部 extra。
- 延迟响应期间继续输入保持最新内容；服务写成功后网络丢回执，重试使用同 mutationId；双窗口冲突保留另一窗口权威值，冲突窗口刷新仍保持冲突稿；新建在 await leave 前同步锁编辑。
- 新离线副本可切换、从 local 列表重新打开并联网重试。异步原图和导出按 documentKey 隔离。延迟原图时导出，再把画板改蓝，导出像素仍为原色 [228,233,223,255]，当前画板为 [0,0,255,255]。
- 1440px/375px、键盘 Enter 创建文字、可见焦点、reduced motion 和水平溢出检查通过。无未预期 console/page error；故意丢回执的 net::ERR_FAILED 是测试注入。
- 按 2026-10-28 最新 Web Interface Guidelines 检查语义、输入标签、焦点、移动布局、状态与 reduced motion。截图为浏览器未加工原图。

原图缺失时正式保存不能被确认为成功，显示错误并保留草稿。恢复稿不包含图片原件；跨安装请导出完整工程。支持本工作台 JSON，而非任意 Konva serialization。无撤销/多选/图像滤镜。默认源码包不含业务数据；Host import=unverified。
