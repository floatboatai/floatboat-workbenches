# Fabric.js 海报排版台

围绕一张固定尺寸画板制作海报：用模板起稿，在画布直接改字、拖动、缩放和旋转，再用坐标与图层检查器精调，导出成品。

![Fabric.js 海报排版台](../../docs/screenshots/fabric-js.png)

- Fabric.js 7.4.0 原生画布，支持文字、矩形、椭圆，复制、删除、图层顺序和 60 步会话撤销/重做。
- 位置、尺寸、缩放、角度、颜色、描边、圆角，以及系统字体、字重、对齐。
- 植物市集、设计分享夜、空白方形三种模板；自定义画板与常用尺寸。
- 原生文字编辑实时自动保存。未应用属性和不完整 JSON 输入独立保存，重开可继续。
- PNG 原始像素导出、SVG 矢量导出、便携项目 JSON；导入和模板创建新项目。
- SQLite 项目存储、同源本机恢复、重试和版本冲突处理。无需模型或外部平台服务。

从仓库根目录运行：

```sh
pnpm workbench prepare fabric-js
pnpm workbench check fabric-js
pnpm workbench test fabric-js
pnpm workbench dev fabric-js
pnpm workbench package fabric-js
```

打开预览命令打印的完整地址。源包通过 **Floatboat → My → Workbenches → Import workbench** 导入。源包默认不包含预览数据库；预览数据留在 `.local/`。

支持的项目是本工作台的 schemaVersion=1 JSON，不是任意 Fabric scene。最多 160 个对象、每对象 8000 字、500 KB 模型，导入文件 550 KB；画板 128–4096px、总面积最多 1200 万像素。文字高度自动计算，字体依赖设备。图片、SVG 输入、路径、分组、渐变、外链、服务端渲染、AI 和印刷色彩管理不在此版本范围。工作副本下载含模型和未应用草稿，供人工恢复；常规项目导入使用其 `snapshot.data` 或项目 JSON。IndexedDB 恢复仅限同一浏览器来源；不同预览端口和设备不会共享缓存。

验证：13 项领域/SQLite 自动保存测试；实际 Chrome 验证原生编辑和几何变换、图层/撤销、属性草稿与输入恢复、背景保存确认、导入新建、导出内容、丢失响应、并发冲突和窄屏/暗色/reduced-motion。详细证据见 `app/ENGINEERING.md` 和开发时生成的 `.cache/`。Floatboat 桌面导入尚未验证；没有把本地测试当作 Host 业务调用。

上游：[Fabric.js](https://github.com/fabricjs/fabric.js)、[官方文档](https://fabricjs.com/docs/)、[事件](https://fabricjs.com/docs/events/)。依赖与许可证：Fabric 7.4.0（MIT，完整声明位于 `app/src/notices/fabric.LICENSE`）；React 19.2.3 / React DOM 19.2.3（MIT）；Lucide 0.562.0（ISC）。浏览器集成通过限定 pnpm overrides 排除 Fabric 可选的原生 canvas/jsdom；不提供 Node 渲染。
