# 组件制图 · OpenPencil

在原生FIG文档上选择、修改和交付小型设计画板。使用OpenPencil 0.16.0的SceneGraph、FIG读写和SVG导出核心。

![组件制图](../../docs/screenshots/openpencil.png)

- 原生FIG导入；画板、矩形、圆形、文字新增，既有图层尺寸/位置/颜色/文字修改、复制与删除。
- 原生文件与未应用属性、JSON草稿、交付备注自动保存；刷新/进程重启恢复，冲突保护，导入创建新项目。
- 导出FIG、上游SVG和包含未完成编辑的完整项目。上限600KB原生文件、1000图层、30页。
- 固定CSP下使用服务端上游SVG渲染，不加载浏览器CanvasKit/WASM，不复制上游完整GUI。高级组件/蒙版/效果按上游编解码及SVG导出支持范围处理，未承诺Figma像素级兼容、云协作或AI生成。

```sh
pnpm workbench prepare openpencil
pnpm workbench check openpencil
pnpm workbench test openpencil
pnpm workbench dev openpencil
pnpm workbench package openpencil
```

源码包不含业务数据，Floatboat → 我的 → 工作台 → 导入工作台；客户端导入尚未实测。详细证据见[ACCEPTANCE.md](ACCEPTANCE.md)。

上游：[OpenPencil](https://github.com/open-pencil/open-pencil)，核心MIT原文随声明资源保留。
