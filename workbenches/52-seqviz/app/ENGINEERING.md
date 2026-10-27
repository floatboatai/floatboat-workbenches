# 工程说明

contracts/sequence.ts 负责单条 FASTA、IUPAC DNA、区间坐标、反向互补、文档允许列表与导出。SeqViz 3.10.25 按需加载，在 adapter 中统一坐标转换。disableExternalFonts=true；Roboto Mono 使用同源 fontsource 静态字重。

UI项目数据与未应用原文/未提交特征/意见草稿分离；externalDirty纳入通用项目hook，所有项目切换仅成功后重置草稿。导出与保存不忽略草稿。Node同源API与SQLite存储文档，版本保护保留，保存成功后的列表刷新失败不改变成功结果。

序列原文和上限内标注存项目JSON。替换序列须显式清除旧坐标，模型不推断或生成序列。整个页面无任意脚本、WASM或原生模块；manifest 无模型能力。测试核对跨原点、方向、坐标往返、格式往返及磁盘恢复。

真实浏览器已核对 SeqViz 的反向特征回调：其返回 clockwise=false，但不一定保留 direction/id。适配层先还原正向坐标边界，再将逆时针选区转换为反向互补，不依赖缺失的回调字段。整环图形以1–N显示，原始项目坐标保留。
