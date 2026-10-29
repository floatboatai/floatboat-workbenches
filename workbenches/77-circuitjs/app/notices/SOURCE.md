# CircuitJS1 对应源码与许可

上游：https://github.com/pfalstad/circuitjs1
固定提交：e952e788a4135a693bfd4cee7883f9b3314e3e76
源快照：upstream/ 下保留该提交完整 ts/、README.md、COPYING.txt。原始文件 SHA-256 在 upstream-sha256.json；上游源码未修改。

CircuitJS1 的 CirSim.ts 和 README 明确授权 GPL-2.0-or-later，ts/package.json 中 ISC 字段不覆盖源码授权。本工作台整体以 GPL-2.0-or-later 分发，包括原创包装层和适配器；完整许可随 app/LICENSE 与 upstream/COPYING.txt 提供。版权归 Paul Falstad、Iain Sharp 及各文件作者。React、ReactDOM、Lucide、lz-string 的兼容第三方许可另存 runtime-licenses/。原生字体等资源及各自许可与源码共同保留。

## 构建与修改

从仓库该应用目录先运行 `pnpm install --ignore-scripts`，然后 `node app/engine-src/build.mjs`。Node 22、esbuild 0.27.2、lz-string 1.5.0 固定于锁文件；生成 engine/circuit.js、HTML、CSS、字体。native esbuild 保留类名，避免 ElementFactory 依类名查找失效。无 GWT、WASM、动态代码求值、服务工作线程和外部脚本。

源码包内资源由 manifest 重定位；通过 engine-source 资源声明找到 build.mjs，使用 application/ 下的 package/锁文件安装依赖后运行该脚本。脚本从最近 manifest 解析 engine/notices/engine-source 目录；不假定原机器路径。构建输出中的路径注释可因资源目录重定位而不同。

engine-source/bridge.js 与 engine-source/policy.js 是所有原生集成变更的完整来源：以同源 iframe 隔离全局类/事件；固定文档键和冻结快照；禁用上游隐式恢复、默认电路异步加载、浏览器全局子电路模型、SRAM 本机文件读取、音频播放与宽泛文件/服务菜单；以引擎自身的类型表检查导入来源，仅拒绝音频输入、数据输入、数据导出 3 类元件（理由写在 policy.js）；关闭尚未覆盖草稿恢复的高级示波器属性/浮动图表/子电路创建入口；滑块由外层仪器台通过上游 Adjustable 创建、调节与移除；跳过原生拖动结束产生的重复撤销快照；原生 EditDialog 预校验未完成数字并采集输入草稿；原生成功 timestep 绑定测量配置指纹并实现单步；桥接原生运行、速度、撤销/重做、元件参数、Scope、XML dump、PNG 与数值读数；退出清理计时器。求解器、元件方程、原生绘制与 XML 序列化算法未修改。canvas2svg 的 CommonJS 分支警告是上游浏览器兼容检测，浏览器走 window 分支。

示例库：upstream/ts/public/setuplist.txt 与 public/circuits/ 下 373 个示例文件属于同一上游快照（GPL-2.0-or-later，未修改），由本地服务只读提供，不联网获取。

此版本可本地构建、打包与 GPL 源码交付；现有 Floatboat 商店 release 路径要求 MIT，故不声明可发布到商店，也不绕过许可检查。客户端导入未实测。
