# glTF 模型优化台

把真实导出的 GLB / glTF 变小、变快且不坏：看清绘制调用、三角面、上传顶点、贴图显存与关键帧，逐步运行 glTF Transform 的优化步骤，每一步都在模型上预览、与原件对比、可撤销，最后导出（可选 Meshopt / Draco 压缩）。

![模型优化台实景](../../docs/screenshots/gltf-transform.png)

## 从模型开始

1. 空态中心“选择模型文件”：GLB、glTF 与其 .bin/贴图（可多选）、ZIP，或直接拖入画布；也可“载入风机样例”。合计 ≤ 64 MB，不需要先建工程。
2. 右侧“优化”检查器列出 11 个一键步骤：剪除、去重、焊接、简化（保留比例/误差上限/锁定边界）、重采样（容差）、量化（位置/法线/UV 位数）、展平、合并网格、实例化、居中（基准）、缩小贴图（最长边）。点“运行”即追加一步并预览结果。
3. 右上阶段条（原件 › 剪除 › 去重 …）点哪段就预览哪段；检查器顶部的对比表给出原件 → 当前阶段的文件大小、绘制调用、三角面、上传顶点、材质、显存估算与关键帧变化。阶段栈逐步列出大小变化、耗时与说明，可撤销上一步（⌘/Ctrl+Z）或移除任意一步，只重算受影响的部分。
4. 材质（名称/PBR/透明/双面/extras）、节点（名称、平移/欧拉旋转/缩放，原件视图实时预览）、贴图（尺寸、格式、显存、用途、替换为 PNG/JPEG/WebP）是同一份修订配方，“应用修订并更新结果”后进入流水线。
5. “动画”列出片段的时长、通道、关键帧与目标节点，点击即在画布播放；“报告”给出完整统计、扩展、网格表与警告。
6. 导出 GLB：无压缩、Meshopt 或 Draco，导出前在服务端回读校验。“完整工程”是 ZIP（project.json + 原件、各阶段与替换贴图）。

左上“资产库”列出已保存资产与本机草稿，提供打开模型、导入工程或恢复稿、另开资产、删除当前与补齐缺失资源。

## 模型范围

底层是 [glTF Transform](https://github.com/donmccurdy/glTF-Transform) 4.5.1：`@gltf-transform/core` NodeIO + `@gltf-transform/extensions` 的全部扩展 + `@gltf-transform/functions`；meshoptimizer 1.2.0 提供简化与 Meshopt 编解码，draco3dgltf 1.5.7 提供 Draco 编解码，pngjs/jpeg-js 负责贴图缩放，fflate 处理 ZIP。Three.js 0.185.0 负责预览。

- 输入：GLB 2.0、glTF + 外部 .bin/贴图（多选或 ZIP，含子目录）、内嵌 data URI。KHR_materials_*、KHR_texture_transform、KHR_mesh_quantization、EXT_mesh_gpu_instancing、KHR_lights_punctual、KHR_materials_variants 等随模型保留；Draco 与 Meshopt 压缩在导入时解码，导出时可重新压缩。未识别的可选扩展会提示将被移除；未识别的必需扩展、缺失的资源文件、多个模型、剪切矩阵节点给出具体原因。
- 体量：导入合计 ≤ 64 MB；规范 GLB 与各阶段 ≤ 128 MB；节点 ≤ 50,000、网格 ≤ 20,000、贴图 ≤ 1,024 张、单张 ≤ 16384 px、总像素 ≤ 256 MP、上传顶点 ≤ 1,200 万。SDK 的 JSON 请求体固定为 2 MB，因此文件以 1 MiB 分块上传。
- 预览：PNG/JPEG/WebP/AVIF 贴图正常显示；KTX2 贴图保留在文件中，预览为灰色占位。WebGL 不可用时流水线、报告与导出仍可用。
- 限制：实例化在含动画的模型上不生效（glTF Transform 限制，步骤会说明）；缩小贴图只处理 PNG/JPEG；不提供骨骼绑定或动作创作。

名称、未完成的数值/JSON/TRS、修订配方、流水线步骤与每步报告、步骤参数草稿、当前预览阶段、相机、动画位置、导出压缩方式与备注自动保存。无效输入保留为工作稿；导入工程总是创建新文档。0.8.x 的 JSON 工程与恢复稿可继续导入。

## 运行与交付

```sh
pnpm workbench prepare gltf-transform
pnpm workbench dev gltf-transform
pnpm workbench check gltf-transform
pnpm workbench test gltf-transform
pnpm workbench package gltf-transform
```

版本 0.9.0。应用与 glTF Transform 采用 MIT；meshoptimizer、pngjs、fflate MIT，draco3dgltf Apache-2.0，jpeg-js BSD-3-Clause，声明见 `app/notices/`。`ndarray-pixels` 静态引用的原生库 sharp 由锁文件替换为空函数包，应用不调用它。本地验收与客户端导入分别记录，详见 [ACCEPTANCE.md](ACCEPTANCE.md)。
