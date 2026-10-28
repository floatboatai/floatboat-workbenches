# glTF 资产检查台

把 glTF 交付前的检查留在同一张桌上：查看节点、PBR 材质、内嵌图像和资源体积，编辑名称、材质与 JSON 附加信息，再生成可重新解析的 GLB。

基于 [glTF Transform](https://github.com/donmccurdy/glTF-Transform) 的官方 `@gltf-transform/core` **4.5.1**。原生 NodeIO 负责读写；Three.js 0.185.0 只负责预览和内置样例几何。没有接入模型调用，也没有把 CLI 的完整 optimize 管线当作浏览器功能。

![资产检查台实景](../../docs/screenshots/gltf-transform.png)

## 工作流程

1. 导入普通、自包含的 GLB，或载入陶土与瓷器材质样例。
2. 从左侧选择节点、材质或资源。右侧建立修订配方；原件保持独立。
3. 记录交付备注，点击“生成修订”。原生读写后会回读校验未编辑的几何、图像、骨架、动画及材质配置。
4. 切换原件/修订结果查看，导出结果 GLB；“完整工程”包含原件和结果资源，适合迁移到另一个实例。

名称、未完成的数值与 JSON 输入、修订配方、选择、相机、动画位置、检查备注均自动保存。无效输入会保留为工作稿，不能生成修订。恢复后动画保持暂停。处理期间修改配方，会丢弃过期处理结果；切换工程后迟到结果不会覆盖新工程。

“恢复工作稿”只带资源引用；跨实例缺少模型时，界面显示补齐入口，匹配 SHA-256 后立即重新读取。完整工程则携带模型原件和修订结果。普通 `.fbworkbench` 安装包不包含用户模型或数据库。

## 支持范围

- GLB 2.0，单文件 ≤ 1.4 MB；普通三角网格、PBR 材质、内嵌 PNG/JPEG。
- ≤ 50,000 个有效/实例顶点，256 节点、64 网格、128 材质、32 图像；单图最大 2048×2048，总图像像素 ≤ 8 MP。
- 接受的 skin、inverse bind matrices、TRS 动画原样保留；动画可显式播放或逐帧检查。几何与动画访问器数组、图片 hash 做精确比较；NodeIO 默认值规范化产生的 TRS 浮点差异容差为 1e-5。
- 扩展、Draco、meshopt、KTX2、外部 URI、Morph、相机、稀疏访问器、非三角图元、剪切/退化变换和不能可靠保全的技术元数据明确拒绝。先在上游工具导出普通 GLB。
- 不做网格简化、压缩、绑定骨架或动作创作。无 WebGL 时仍可使用检查表、修订、保存与导出。
- 正式工程数据 ≤ 850 KB，恢复数据 ≤ 2 MB，恢复 snapshot ≤ 1.95 MB；完整/恢复 JSON 外层 ≤ 12 MiB。模型独立存储，不塞进自动保存正文。

## 本地运行

在仓库根目录执行：

```sh
pnpm workbench prepare gltf-transform
pnpm workbench dev gltf-transform
pnpm workbench check gltf-transform
pnpm workbench test gltf-transform
pnpm workbench package gltf-transform
```

版本0.8.0。应用和原生引擎均为MIT；原文许可和来源见 `app/notices/`。本地验收与实际 Floatboat 客户端导入分别记录；客户端导入状态见 [ACCEPTANCE.md](ACCEPTANCE.md)。
