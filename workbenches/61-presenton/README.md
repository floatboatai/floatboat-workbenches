# Presenton 工作台

把一份资料做成能讲的演示稿：**资料 → 大纲 → 成稿 → PPTX / PDF**。粘贴或读入资料（.md .txt .docx .html .csv），本地确定性生成大纲（表格变原生图表、带数字的要点变关键数字、“时间：事项”变时间线、两个小节变左右对比），再按 11 种版式生成幻灯片，在舞台上逐页修改标题、要点、图片、图表数据、版式和主题，导出带原生图表与演讲备注的 PPTX，或逐页位图的 PDF。

```sh
# Repository root
pnpm workbench prepare presenton
pnpm workbench check presenton
pnpm workbench test presenton
pnpm workbench dev presenton
pnpm workbench package presenton
```

无 Presenton 服务、无 Floatboat 时完整可用。两个可选通道：

- **Floatboat 模型起草大纲**：在资料页“生成大纲”下方，显示状态与重新检查，确认后才发送资料，结果作为候选。
- **Presenton 服务**：大纲页“生成幻灯片”旁的状态胶囊，点开给出启动方式与重新检查；连接后可把大纲交给自建 Presenton 生成并下载原件。见 [配置说明](app/PRESENTON.md)。

示例《城市绿荫计划 · 试点评估与第二期提案》是原创虚构资料，示例成稿由本地生成器从这份资料产出。

[产品要求](app/REQUIREMENTS.md) · [设计](app/DESIGN.md) · [工程说明](app/ENGINEERING.md) · [验收记录](app/ACCEPTANCE.md) · [第三方来源](NOTICE.md)

可导出 `.fbworkbench`，通过 **Floatboat → 我的 → 工作台 → 导入工作台** 安装；源包不含预览业务数据或服务密钥。真实 Host 调用、真实 Presenton 实例与客户端导入尚未验证。
