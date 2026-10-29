# FigCraft原型校样

主任务：逐屏审阅原生 `.figcraft` 设计并交付。必须在没有任何外部服务、没有 Floatboat Host 的情况下完成：打开示例或导入文件 → 选画板 → 改文案/名称/填色 → 记备注 → 标记交付状态 → 导出 `.figcraft`、交付说明、SVG/PNG 近似图。

- 读取：zip 内 `document.json`（format figcraft v1），列出各页顶层 frame/component/componentSet（含 section 内画板）。
- 渲染：内置近似渲染，明确标注“近似校样”；原生渲染/PNG/PDF 仅在引擎在线时提供，否则在动作旁显示引擎状态卡（命令、地址、重新检查），不显示原始网络错误。
- 修改：characters、name、单一纯色填充、dev_status、同页画板顺序；直接写 `document.json` 并重新打包，其它条目字节不变；与 CLI 0.11.2 语义一致。
- 自动保存：原生文件与逐屏备注为正式数据；未应用文案/名称/填色、当前画板/图层/标签、工程 JSON 草稿为工作稿草稿；导入另建校样。
- 上限：原生文件 1.35 MB、60000 图层、展开 80 MB，超限给出原因与处理建议。
- 不是完整 FigCraft GUI 或云协作；模型不参与渲染。
