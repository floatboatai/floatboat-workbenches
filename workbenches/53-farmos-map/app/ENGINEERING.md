# 工程说明

项目固定 @farmos.org/farmos-map 3.0.0 与 OpenLayers 10.11.0，根目录和 app 均使用精确版本与锁文件。FieldMap.tsx 通过真实 MapInstanceManager 创建地图、addLayer 创建矢量图层，使用 OpenLayers Draw/Modify 编辑Polygon。移除默认OSM层与默认联网控件、禁用自动behavior，保留本地经纬网与坐标数据；不修改上游库、官方构建或CSP。

contracts/model.ts 是共同数据契约：单外环、经纬坐标范围、闭合、顶点数、自交、重复点、面积/跨度边界，以及GeoJSON/项目JSON进出校验。首版最多30分区、每分区200顶点、总计2000顶点。环方向统一为逆时针。球面面积半径6371008.8m，不把WebMercator投影面积当作地面面积；合计是分区面积之和，不扣除分区重叠。CSV转义逗号、换行、引号，并保护文本单元格的公式前缀。

server/routes.ts 为同源CRUD；store.ts 使用SQLite参数化SQL与revision乐观锁。没有LLM、模型路由、地图/地理编码外部服务。保留原迁移编号及appId；不提交preview业务数据。导入先完整解析验证，再确认覆盖；读取文件期间切换项目会拒绝继续导入。数据库写入与列表刷新状态分别处理，避免保存/删除成功后误报操作失败。

ui/App.tsx 编排项目和未应用坐标，PlotRegister/MapSheet/CoordinateEditor/ExportBar分担展示。地图懒加载，ResizeObserver、交互、Map实例在卸载清理。坐标草稿与圈绘状态有beforeunload及新建/切换/导入保护；未应用时禁止导出旧数据。地图编辑期间锁定坐标编辑，避免两种输入互相覆盖；持久化忙碌期间主工作区inert。

验证：pnpm workbench:check、pnpm test；7项测试覆盖实际面积公式/OpenLayers交叉对照、输入边界、往返导入导出、CSV与SQLite重开/版本冲突。Chrome验证真实圈绘、拖点、键盘坐标、错误恢复、保存重开、导出独立解析、375px及dark/reduced-motion。CSP不变且无外部资源请求。版本冲突回归刻意产生一次HTTP409（UI保留输入），不计为未处理异常。Floatboat客户端导入尚未验证。
