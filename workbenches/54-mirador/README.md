# 馆藏对照室（Mirador）

版本 **0.2.0**。专业双图光台：左侧资料抽屉、中央图像对照、右侧复核账本。使用真实 Mirador，支持缩放、平移、旋转和页级复核。

从总仓库运行 `pnpm workbench prepare mirador`，再运行 `pnpm workbench dev mirador`。添加 PNG/JPEG，选择左右资料页并记录意见。页名、视图、复核记录和未添加的意见草稿自动保存；导入完整项目会创建独立项目。保存失败或冲突有明确状态，后台保存保持编辑可用。

原图存于声明的数据资源，按 SHA-256 去重并原子写入。数据库保存元数据与工作副本；原图不会只留在临时 URL。可移植 JSON 项目携带原图，CSV 用于复核交接。移除资料页或项目不会自动删除共享原图。两张自带资料页为原创演示图文。

## 范围

每项目20页、100条复核记录；PNG/JPEG每张最大1MiB、边长10000像素、总像素3000万；完整项目包最大30MB。仅接收本地图像，没有任意远程IIIF导入、OCR、自动差异检测或馆藏写回。无需模型服务。

## 验证

固定模板构建与15项测试通过，涵盖领域输入、原图/项目落盘、CSV、IIIF、事务幂等、草稿和冲突。Chrome桌面/375px实际验证双图、原图哈希、视图自动保存、草稿恢复、项目往返、CSV、延迟回包继续输入、响应丢失重试、错误输入、版本冲突、深色与reduced-motion。通用本机草稿索引另有同来源新标签、离线切换找回和存储失败回归。

运行 `pnpm workbench package mirador` 生成 `.fbworkbench`，在 Floatboat「我的 → 工作台 → 导入工作台」使用。源包不含用户扫描页或预览数据库；客户端实际导入安装仍未实测。

上游 [Mirador](https://github.com/ProjectMirador/mirador) 固定4.3.0，Apache-2.0。详见 [NOTICE.md](NOTICE.md)、app/DESIGN.md和app/ENGINEERING.md。
