# CircuitJS1 0.9.0 验收 · 完整元件库、示例库与仪器控制

功能验收：**local-verified**（本地预览 + 真实 Chrome for Testing，全新数据目录）。结构审查：沿用已通过的 0.8.1 仪器台结构，新增能力放在既有三个区域内，见下方“结构审查”。Floatboat 客户端导入：**unverified**。appId、registryName、storageKey `circuitjs-v08`、数据表与 3 个已应用迁移保持不变；没有新增依赖。

## 命令

- `node scripts/workbench.mjs check circuitjs`：通过（仅共享 autosave-client.ts 的 WORKBENCH_LARGE_MODULE 警告）。
- `node scripts/workbench.mjs test circuitjs`：16/16 通过（新增 `tests/parts.test.ts` 6、`tests/examples.test.ts` 4；原有 circuit 5、app 1，其中 683 份上游文件 SHA-256 一致）。
- `node scripts/workbench.mjs package circuitjs`：`circuitjs-studio-0.9.0.fbworkbench`，753 个文件、2,077,765 bytes，SHA-256 `03624fc38a9db5cac97ac8f607f75072579a39852f4ee4d4dca83189110493aa`，不含业务数据；解包后在包内直接运行 `node --experimental-strip-types --test tests/*.test.ts` 16/16 通过（元件策略按 manifest 的重定位资源路径加载）。
- `node app/engine-src/build.mjs` 两次构建 `engine/circuit.js` SHA-256 相同（可复现）。

## 浏览器流程（Playwright + Chrome for Testing，1440×900，全新 `.local/data`）

1. **首次打开**：无任何外部服务即显示「555 LED 闪烁器」，自动保存为“已自动保存”；探针默认选中第一个非导线元件（电容）。运行后示波器显示电容锯齿与 15.2 Hz 输出方波，LED 闪烁；滑块条显示 Timing Resistor 47 k。
2. **元件库**：检索并回车放置 NPN、555、与门、逻辑输入、逻辑输出、LED、N-MOSFET、电位器，探针列表新增 8 个对应中文名称元件。NPN 探针显示“default, β=100 / cutoff / Ic / Ib / Vbe…”，原生参数框含 Beta/hFE，改为 150 后显示 β=150；555 参数框（Ground Pin / Show Pin Numbers）可打开。
3. **导出→导入往返**：含三极管、555、与门、逻辑输入/输出、LED、MOSFET、电位器的电路导出 XML（标签 `t Timer And L M LED f pt`），作为新实验导入后再导出，582 字节内容**逐字一致**。画布 PNG 头为 PNG（1378×659）；实验记录 Markdown 含 `<Timer` 电路快照与 Transistor 读数。
4. **示例库**：366 个官方示例逐个由原生引擎检查，**366/366 可打开**（曾经排除的音频输出改为允许后，13 个滤波/振荡示例恢复）。抽样作为新实验打开并运行 17 个（ohms、lrc〔3 个滑块〕、555square、butter10loaud、relaytff、zenerref、mirror、crystalosc2、cmosnand、sipo-sr、r2rladder、tlterm、tesla、gyratorelm、counter、7segdecoder〔262 元件〕、alu74181〔420 元件，超过旧 256 上限〕等），全部推进仿真时间、无停止消息。
5. **仪器控制**：暂停状态单步时间 0 → 20 μs 且保持暂停；运行中经原生参数框把电阻改为 33k，仍为“运行”、电压读数有效；运行中导出电路文件后仍在运行，文件含 `r="33000"`；复位后保持运行；速度拖到 150 后显示 13.1 ms/秒，刷新后仍为 150。
6. **滑块**：为 470 Ω 电阻打开滑块表单，最小 100 / 最大 2. 时提示“滑块范围无效…”；把最大值留为未完成的 `2.2k-` 等待保存后刷新，表单恢复 `LED 限流电阻 / 100 / 2.2k-`；改为 2.2k 后添加，滑块条出现第二条；拖到最右得到 2.2 k，刷新后仍在且值保持；移除后撤销恢复。
7. **自动保存契约**：首个 POST 被拦截延迟 4 s 期间继续输入笔记 B，刷新后笔记含 B；原生参数框输入 `-` 未提交，刷新后底部显示“参数草稿 Resistance (ohms)：-”；导入文件后服务端项目数 1 → 2，原实验保留。
8. **画布选择同步**：在画布上点击 LED、555、1M 电阻，探针分别切换为“20 · 发光二极管”“09 · 555 定时器”“05 · 电阻”。
9. **布局与键盘**：1440 与 375×812 下 `scrollWidth` 等于视口；元件库可用 Enter 打开、焦点进入检索框，Esc 关闭后焦点回到「元件库」；示例库 Esc 关闭后焦点回到「示例库」。375 下页面纵向滚动，滑块表单、时基与读数完整可见。
10. 各流程 pageerror / console error 为 0。剩余的提示是 Chrome 对同源 sandbox iframe 的固定 warning（0.8.1 起即存在），以及共享 autosave 已知问题的确认框（见下）。最终截图 `docs/screenshots/circuitjs.png`：1440×900，555 闪烁器运行中，LED 点亮、两路波形、滑块条与 555 探针状态行。

验收中发现并修复：
- 若干示例（mirror、relaytff、alu74181 等）中单端元件在首次 stamp 前读取第二节点电压抛错，导致整轮读数停止；改为逐元件 try/catch。
- 检索 “led” 回车放置了“标号节点 Labeled node”；改为精确/前缀优先的排名。
- 上游滑块条位置只到 99/100，配置的最大值不可达（2.2k 只能到 2.18k）；改为 100。
- 375 下滑块表单被固定高度裁剪；≤780 px 改为页面纵向滚动。
- 预览服务器在其他并行任务清理进程时被终止；验收改用独立启动脚本，结果不受影响。

**未修复（共享代码，按分工不改）**：保存成功后切换/导入文档仍会弹出“当前内容已恢复，但本机缓存尚未修复…”确认框；确认后行为正确。

## 元件范围与排除理由

上游注册的全部电路元件均可加载与仿真；元件库 141 个可放置元件，`tests/parts.test.ts` 用上游 Menus.ts 校验每个菜单元件都在元件库或带理由的排除表中。

| 元件 | 处理 | 理由 |
| --- | --- | --- |
| AudioInputElm 音频输入 | 不开放 | 读取本机音频文件并解码为信号源 |
| DataInputElm 数据输入 | 不开放 | 读取本机 CSV/文本文件 |
| DataRecorderElm 数据导出 | 不开放 | 只能生成浏览器下载，嵌入 iframe 无下载权限，数据会静默丢失 |
| AudioOutputElm 音频输出 | 可加载、不在元件库 | 正常仿真但不发声：播放按钮属于未渲染的原生侧栏，`playAudio` 被置空 |
| ExtVoltageElm 外部电压 | 可加载、不在元件库 | 只能由外部脚本经 JS 接口驱动 |
| SubcircuitElm 通用子电路 | 可加载、不在元件库 | 需要先有模型；内置 LM317 / TL431 在元件库中 |
| ScopeElm 画布示波器 | 可加载、不在元件库 | 由尚未开放的浮动示波器入口创建 |

## 结构审查（与功能验收分开）

0.8.1 结构已通过；本次复核 1440 与 375 的真实截图：电路 + 示波器仍是主空间；元件库是元件架的按需延伸（叠在画布左缘，选中即关）；速度/单步在时基内；滑块条贴着仪器台上沿，仅在有可调元件时出现；示例库是实验簿的一页。没有新增顶部工具条或常驻侧栏，文件生命周期仍只在实验簿。结论：**沿用通过**。限制：1440 下有滑块条时画布高度减少约 46 px；示例预览是端点示意而非原生渲染。

## 仍然限制

- 示例标题沿用上游英文；顶层分类有中文名。
- 示例布局预览只画元件端点连线（芯片显示为短段），以引擎检查结果和元件构成作为补充。
- 滑块表单的错误在页面提示条显示，未逐字段内联。
- 高级示波器属性、浮动示波器、子电路创建、音频播放与数据文件元件仍不开放。
- 波形历史不持久化；画布空间操作不是完整的屏幕阅读器流程。
- 未在 Floatboat 客户端中导入安装包（unverified）；GPL 包不声明可上架 MIT-only 商店。
