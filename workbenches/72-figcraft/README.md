# 原型校样 · FigCraft

逐画板检查原生FigCraft设计，修改文案与画板名称，记录交付意见，并生成设计交付物。

![原型校样](../../docs/screenshots/figcraft.png)

- 导入/导出原生`.figcraft`文件，使用官方CLI 0.11.2真实Rust CPU渲染。
- 逐画板切换、文案修改、画板名称草稿和原生可交付状态；不同画板的待应用修改独立保存。
- 完整设计、校样备注与未应用输入自动保存，刷新恢复、版本冲突保护、导入新项目。
- 实际PNG、SVG、PDF导出和完整项目JSON。600KB文件、1200图层、30页限制。

本项目收窄为原型校样，没有嵌入整套FigCraft桌面GUI或云协作。现有原型/组件保存在原生文件中，但这里不执行完整原型交互或替代所有图层工具。源码包不含原生CLI和预览业务数据。

## 引擎

先按[service/README.md](service/README.md)安装固定版本CLI并启动独立服务，默认`127.0.0.1:8796`。工作台服务用`FIGCRAFT_SERVICE_URL`连接，可选服务器侧token。无须模型账号或GPU。

```sh
pnpm workbench prepare figcraft
pnpm workbench check figcraft
pnpm workbench test figcraft
pnpm workbench dev figcraft
pnpm workbench package figcraft
```

Floatboat → 我的 → 工作台 → 导入工作台；客户端源包导入尚未实测。安装源码包与启动引擎服务是两个步骤。详细证据见[验收](ACCEPTANCE.md)。

上游：[FigCraft](https://github.com/storytold/figcraft)，MIT或Apache-2.0；本项目保留上游NOTICE和许可证，未复制品牌标识。
