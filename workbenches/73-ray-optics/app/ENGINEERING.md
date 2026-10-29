# Ray Optics 工作台工程（0.9.0）

## 原生内核

固定 ricktu288/ray-optics 提交 daf76772c73a85e1a2568c4e2e71613bba1fab77（5.5.0）。`notices/ray-optics/build-vendor.mjs <upstream>` 复制上游 `src/core` 与 en/zh-CN 文案、应用 `patches/embedding.patch`（ESM 导入形状与嵌入画布指针坐标）、用固定 esbuild 0.27.2 打包 `src/ui/vendor/ray-optics.js`（压缩、许可置尾、mathjs 统一为 15.2.0），并从 bundle 自身的 `serializableDefaults` 生成 `src/contracts/native-schema.ts`。`notices/ray-optics/source/package.json` 是包边界：上游源码按 webpack 的 CommonJS 互操作编写（如 evaluatex 默认导入），不能继承 app/package.json 的 `"type": "module"` 语义。新增运行时依赖 mathjs 15.2.0、evaluatex 2.2.0、tex-math-parser 2.0.5（精确版本、pnpm 锁定；许可见 notices）。

bundle 约 1.8 MB，经 `engine.ts` 的 `loadOptics()` 动态导入，页面外壳先渲染。

## 实时追踪

`bench-mount.ts` 为每个 documentKey 建立 5 层画布（grid / below / light 2D / light WebGL / above），`Simulator(enableTimer=true, rayCountLimit=质量上限, glMain=WebGL 或 null)`，`manualLightRedraw=false`。上游 Editor 在拖动中自行调用 `updateSimulation`，每次移动重启追踪，首个 50 ms 分片立即绘制；`simulationStart/Pause/Complete/Stop` 事件按动画帧汇总为 Trace（阶段、段数、耗时、探测器读数、原生错误/警告），只有读数条经 `useSyncExternalStore` 订阅，避免整页随每帧重渲染。非标准亮度映射显示 WebGL 层（`preserveDrawingBuffer` 以便导出）；WebGL 不可用时上游回退并给出错误文案。PNG 在当前追踪结束（最多等 20 s）后合成各可见层，若已达上限或被停止则提示为部分光路。

## 编辑与发布

- 检查器：`ObjBarCollector` 是上游 `src/app/services/objBar.js` 的鸭子类型替身，记录 `createNumber/Boolean/Dropdown/Text/Equation/Tuple/Button/InfoBox` 调用及其 setter；`setControl` 重新收集同一对象（同一“更多选项”状态）并按 id 调用 setter，再 `updateSimulation`。HTML 文案转纯文本，不注入 HTML。坐标来自 `getPropertySchema` 的 point 描述，修改时用上游类重建对象。
- 器材架：`catalog.ts` 的 `presetObject` 只给出初始控制点，在视图中心按当前缩放放入，随后由上游类构造。
- 发布：上游 `onActionComplete → newAction` 时把 `scene.toJSON()` 校验后写入工作稿；参数/微调 250 ms 防抖提交，新增/删除/复制立即提交，切换文档前 `suspend()` 先冲刷。外部 JSON 变化（应用原生 JSON）才 `editor.loadJSON`。撤销/重做使用上游 Editor 历史。
- documentKey + 实例存活检查隔离旧回调；卸载时清理计时器、WebGL 渲染器与监听。

## 校验

`optics.ts` 在客户端与服务端共用：键集合与类型对照生成的上游默认值（上游文本框写出的数字字符串也接受），必需控制点、轮廓点、模块定义、观察者、波长范围、数值与数组/深度上限；背景图片场景拒绝。旧版本场景只在客户端导入时经上游 Scene 升级。`restoreOptics` 对 0.7 工作副本补默认 `quality="standard"`、`example=""`。

## 持久化

SQLite 表与迁移不变（0001–0003）；Optics 新增 quality、example 两个字段，随保存/刷新/完整工程导出/导入往返。storageKey 仍为 `ray-optics-v07`，appId 不变。

## 验证

`pnpm workbench check/test/package`；真实 Chrome（Playwright）桌面 1440×900 与 375 px 流程见 ACCEPTANCE.md。客户端导入单列未验证。
