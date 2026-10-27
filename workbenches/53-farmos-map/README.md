# 田块记录台

使用真实 farmOS-map 圈绘、拖动顶点和键盘坐标表编辑地块，填写名称/备注，保存到 SQLite 后重开。默认显示两个明确标为示例的边界；地图为经纬网坐标视图，没有卫星底图或外部地图服务。

支持导入 GeoJSON Polygon/Feature/FeatureCollection 与本工作台项目 JSON。首版只接受 WGS84 经纬度、单外环，最多30分区、每个200顶点、总计2000顶点。拒绝自交、孔洞、跨日界线和退化边界。坏文件不覆盖原记录，未保存/未应用修改有离开保护。

可导出 GeoJSON、项目 JSON 和面积 CSV。面积按6371008.8m半径球面估算，显示 m²/ha；总面积不扣重叠。输出用于边界核对，不替代实地测绘。

从总仓库执行 `pnpm workbench prepare farmos-map`、`pnpm workbench dev farmos-map`。在本目录执行 `pnpm workbench:check`、`pnpm test`、`pnpm run package`。

7项测试通过；Chrome已验证真实鼠标圈绘/拖点、坐标编辑、SQLite保存刷新恢复、无效输入、取消导入、导出重解析、375px键盘编辑、暗色和reduced-motion。没有未处理页面错误或外部资源请求；冲突测试的预期HTTP409会显示明确错误并保留本地输入。

产物：artifacts/farmos-map-studio-0.1.0.fbworkbench。通过 Floatboat「我的→工作台→导入工作台」安装；客户端实际导入尚未验收。此项目不使用模型服务。

许可说明见 [NOTICE.md](NOTICE.md)。
