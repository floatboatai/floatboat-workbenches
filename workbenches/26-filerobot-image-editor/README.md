# 26 · Filerobot Image Editor 工作台

基于真实 Filerobot React 组件的本地图片工作室。深色照片舞台配原生裁剪、旋转、翻转、调色、滤镜、尺寸和文字/形状标注。编辑自动保存，关闭后可接着处理。

![图片工作室](../../docs/screenshots/filerobot-image-editor.png)

## 使用

从仓库根目录运行：

```sh
pnpm workbench prepare filerobot-image-editor
pnpm workbench check filerobot-image-editor
pnpm workbench dev filerobot-image-editor
pnpm workbench package filerobot-image-editor
```

导入本地 PNG/JPEG，或打开内置咖啡照片示例。顶部显示真实自动保存状态；工程菜单可管理照片、编辑备注、导出 PNG/JPEG 或包含原图的 `.fie.json` 工程。导入图片/工程均创建新项目。版本冲突时先导出工作副本，再打开服务端版本。

生成的 `.fbworkbench` 可通过 **Floatboat → My → Workbenches → Import workbench** 导入。源包默认不含预览业务数据；迁移某张照片请用便携工程。桌面客户端导入仍需单独验证。

## 保存与边界

- 原图存放在声明的 `originals` data resource，以 SHA-256 寻址，原子写入并重复利用；自动保存 JSON 只保存原图信息和编辑步骤。
- 名称、备注、原生编辑状态、未完成尺寸及富文本输入进入完整工作副本。有效模型、待完善草稿、离线及冲突状态分别显示。后台保存不会重建画布。
- PNG/JPEG 原图最多 1,000,000 字节、单边 8000px、总计 1600 万像素；编辑状态最多 400,000 UTF-8 字节、150 个标注；便携工程导入最多 2,000,000 字节。
- 不加载远程图片，不支持 SVG、图片叠加/图像水印、云处理、AI、保留 EXIF 或跨会话撤销历史。文字标注可以做文字水印。删除工程不立即回收共享原图。
- 上游设计恢复仍属实验功能。此实现验证了裁剪、尺寸、调色、滤镜及标注工作副本；重新打开先进入安全的裁剪页，再切换所需工具。建议保留便携工程备份。
- 浏览器 IndexedDB 本机回退仅限相同 origin；不代表跨端口或跨设备同步。

## 验证

`pnpm workbench:check` 通过；`pnpm test` **11/11** 通过。真实 Chrome 验证了原生工具、自动保存/reload、未提交文字、空尺寸草稿、工程导入为新项目、后台延迟确认、提交后丢失响应的幂等重试、版本冲突及新标签页冲突保护、全新离线草稿切换与找回。

独立 Pillow 解码确认输出 600 × 400 PNG/JPEG；正方形裁剪输出为 800 × 800。编辑后 PNG 和裁剪 PNG 在重开前后分别逐像素相同，裁剪内容与原图左上 800 × 800 区域的平均 RGB 差约 1/255（浏览器 JPEG 解码差异）。原图 HTTP 503 时工程导出失败且不下载伪成功文件。1440px 与 375px、深色、减少动态效果、键盘焦点/工具操作及无整页横向溢出已验证。正常主流程没有页面错误或外部资源请求；故障注入产生的预期网络错误单独记录。脚本、导出样本和结果在忽略的 `.cache/`。没有声称调用 AI 或已完成 Floatboat 安装验证。

## 上游与许可

固定依赖：`react-filerobot-image-editor@5.0.0-beta.159`、`react-konva@19.0.7`、`konva@9.3.18`、`styled-components@6.6.0`，外层 React / React DOM 为 `19.2.3`。5.0 beta 是核验时 npm latest，明确声明 React >=19；实际 Chrome 运行验证通过。

- [Filerobot 源码与 API](https://github.com/scaleflex/filerobot-image-editor)
- [onModify / design restoration 文档](https://github.com/scaleflex/filerobot-image-editor#onmodify)
- [上游 npm 包](https://www.npmjs.com/package/react-filerobot-image-editor)
- MIT 软件许可及示例摄影来源见 [NOTICE](app/NOTICE.md) 与 [MIT 原文](app/licenses/filerobot-MIT.txt)。示例图片使用 [Unsplash License](https://unsplash.com/license)，不改变摄影作品的许可。
