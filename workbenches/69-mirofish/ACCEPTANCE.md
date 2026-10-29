# MiroFish 0.9.0 验收

2026-10-29。本地功能 `local-verified`，结构审查 `passed`。完整记录见 [app/ACCEPTANCE.md](app/ACCEPTANCE.md)，设计与结构对照见 [app/DESIGN.md](app/DESIGN.md)。

- Node 22.22.0 / pnpm 10.22.0：check 通过，应用测试 **35/35**，共享自动保存合同测试 **7/7**。
- 独立无头 Chrome 143.0.7499.4：**15 组**真实 HTTP/SQLite 验收通过；1440 与 375 宽覆盖空白到报告的本地主流程、六阶段、自动保存故障、导入恢复、PDF 和导出回读。
- Host 浏览器 **4 组 mock** 验收通过。没有真实 Host/LLM 调用或计费；真实 OASIS/Zep 和 Floatboat 客户端导入未实测。
- 停止并重启本地服务，再用全新 Chrome profile 验证 SQLite 恢复：推演、报告阶段、备注和运行指纹一致。
- 文档定稿后重打 0.9.0 源码包。旧同版本包归档，最终包 CRC、清单哈希、application 源码与资源逐文件一致性见 `acceptance-evidence.json` 和 archive 的 `package-verification.json`。
- 截图：`../../docs/screenshots/mirofish.png`；375px、报告导出截图、脚本、日志、下载文件与旧包在工作区 `archive/2026-10-29-workbench-depth/mirofish/`。

主要变化：从仅复核已有动作，变为资料→图谱→人设→本地推演→观察→报告；扩大原生结果容量；文件生命周期进入推演档案；外部后端和模型均为可选通道。

主要限制：本地服务仍需运行；本地规则模拟不等价于 OASIS/LLM，不是现实预测。资料合计 20 万字符、模型 900KB、200 智能体/240 轮/8 次运行，未做满容量性能验收；PDF 无 OCR。跨机器带入导入结果应使用完整推演文件，不仅是恢复稿。旧逐动作批注不映射为新阶段控件；触控与屏幕阅读器未完整验证。

check 的共享 autosave 大模块提示为非阻断警告，未改共享代码、catalog、根 README 或其他工作台。0.5.0 的验收记录可在 Git 历史查阅，本次未沿用旧包或旧截图作为 0.9.0 证据。
