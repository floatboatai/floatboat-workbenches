# glTF 资产检查台

围绕模型检查材质、节点和交付文件。画布直接占据首屏，材质色板贴近模型，参数与导出收在可关闭的检查器中；已保存资产和本机稿需要时再打开。

![资产检查台实景](../../docs/screenshots/gltf-transform.png)

## 从模型开始

1. 在空态中心打开 GLB，或载入材质样例。无需先创建工程。
2. 点击材质色板，或使用画布左侧的节点、资源与备注工具。检查器可以收起，“适配”会按当前画布比例显示完整模型。
3. 修改名称、PBR 参数或附加信息，点击“生成修订”；原件与结果在画布右上切换。
4. 在检查器中导出 GLB，或下载带原件、结果和工作稿的完整工程。

左上“资产库”显示已保存工程和本机草稿，提供搜索、另开资产、导入与删除当前资产。Escape 关闭后焦点回到入口；打开库或切换检查工具不会重建三维画布。空资产也可从库中打开检查备注。

名称、未完成数值/JSON、修订配方、选择、相机、动画位置和备注自动保存。无效输入保留为工作稿；切换资产会先处理当前保存，迟到结果不能覆盖另一份文件。恢复后动画保持暂停。

“恢复稿”保留资源引用；跨实例缺少模型时可补齐同一 SHA-256 的文件。“完整工程”携带原件和修订结果。0.8.0 工程可继续导入。普通 `.fbworkbench` 安装包不包含用户模型或数据库。

## 模型范围

底层使用 [glTF Transform](https://github.com/donmccurdy/glTF-Transform) 的 `@gltf-transform/core` 4.5.1 / NodeIO，Three.js 0.185.0 提供预览。0.8.1 不改变模型处理、持久化结构或资源边界。

- GLB 2.0、自包含三角网格、PBR、内嵌 PNG/JPEG，单文件 ≤ 1.4 MB。
- ≤ 50,000 个有效/实例顶点、256 节点、64 网格、128 材质、32 图像；单图 ≤ 2048×2048，总图像像素 ≤ 8 MP。
- 支持的骨架、逆绑定矩阵和 TRS 动画随模型保留；几何/动画数组及图像 hash 精确比较。NodeIO 的 TRS 默认值规范化容差为1e-5。
- 扩展、Draco、meshopt、KTX2、外部 URI、Morph、相机、稀疏访问器、非三角图元及无法可靠保全的技术元数据明确拒绝。先在上游导出普通 GLB。
- 不提供压缩、骨架绑定或动作创作。WebGL不可用时仍可检查参数与导出。
- 正式工程数据 ≤ 850 KB，恢复数据 ≤ 2 MB，恢复 snapshot ≤ 1.95 MB；完整/恢复 JSON 外层 ≤ 12 MiB。模型独立存储。

## 运行与交付

```sh
pnpm workbench prepare gltf-transform
pnpm workbench dev gltf-transform
pnpm workbench check gltf-transform
pnpm workbench test gltf-transform
pnpm workbench package gltf-transform
```

版本0.8.1。应用集成与上游核心采用MIT，声明见 `app/notices/`。本地验收与客户端导入分别记录，详见 [ACCEPTANCE.md](ACCEPTANCE.md)。
