# 0.6.0 local acceptance

2026-10-28，固定模板 3b55d46f7ae25e939ce3299073c37ed334d69c02。真实 Chrome channel=chrome / Playwright，1440px 和 375px。最终预览 http://127.0.0.1:65216/。原生 simple-mind-map 0.14.0-fix.3 核心入口，不改 SDK/CSP。

- `pnpm workbench:check` 通过，autosave-client/App 有模块体积建议；`pnpm test` 10/10。
- 原生 SVG 首屏 16 节点，子/同级节点、文字编辑、删除/撤销、分支导航与收起/展开通过。三个结构/主题的实际模型与原生输出匹配。
- 原生 getSvgData 导出经 DOMParser 与 Image.decode 验证：1143×476、18 个 text 元素、22543 个深色非透明像素；原生 getData JSON 保留 smmVersion，导入为新项目且保留分支。
- 双击原位输入后不 blur，刷新仍恢复未结束文字；上下文未应用文字和无效 JSON 原样恢复。实际 exportDraft cacheValue.snapshot 回导产生新 documentId、保留全部 extra。
- 延迟保存可继续输入，不回滚新值；服务写成功但丢回执后以相同 mutationId 重试；两窗口冲突保留双方内容，冲突窗口刷新后仍保持冲突；延迟保存期间新建同步禁用编辑。新离线工作稿可切走、从 local 列表恢复并联网重试。
- 富文本等未支持节点明确拒绝，导入原文留在 JSON 草稿。HTML 字样原位显示为文本，导出 SVG 无 script/image/foreignObject，未执行事件属性。
- 375px 无水平溢出、键盘 Enter 新建子节点、可见焦点和 reduced motion 通过；无未预期 console/page error。故意丢回执产生的 net::ERR_FAILED 为测试注入。
- 首次原生挂载在项目恢复完成之后，避免种子覆盖已保存项目。原生 resize 对断开/零尺寸容器不执行；文件抽屉/滚动及 fit 前刷新 elRect，最终截图复验居中与分支导航。
- 按 2026-10-28 最新 Web Interface Guidelines 审查标签、语义、焦点、窄屏与反馈；截图为普通社区花园示例的原始浏览器 PNG。

快速转场可能遇到共享保存协议的“本机缓存尚未修复”确认；验收明确确认后继续导入，未删除该保护。只支持纯文本核心树与本工作台工程，不把未知字段清理为有效数据。没有富文本、图片、附件、合作编辑、XMind/PDF 或商业插件。默认源码包不含业务数据；Host import=unverified。
