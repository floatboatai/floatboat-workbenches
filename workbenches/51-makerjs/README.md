# 参数制图工房（Maker.js）

基于 Maker.js 0.19.2 的本地参数制图工具，提供四孔圆角面板、规则孔阵列、框形刀模三个固定模板。参数以 mm 输入，真实计算轮廓、孔位和切割路径总长，导出 SVG、DXF 与项目 JSON。支持 JSON 导入、SQLite 保存恢复、版本冲突和未保存保护。

UI 使用参数栏与工程图纸的工作空间，375px 下顺序展示全部操作。图纸仍在生成或参数无效时禁止导出旧图。计算、保存失败均保留输入并可重试。不使用 LLM、任意脚本或机床连接；无排样和刀径补偿，导出后请在加工软件中复核。

## 运行

总仓库运行 `pnpm workbench prepare makerjs`、`pnpm workbench dev makerjs`。检查与测试：`pnpm workbench test makerjs`。打包：`pnpm workbench package makerjs`；在 Floatboat「我的 → 工作台 → 导入工作台」导入源包。

## 本地验收

- `pnpm workbench:check` 与 5 项测试通过，含真实 DXF 独立解析、SVG 尺寸、孔坐标/数量、切割长度、非法参数、磁盘重开与版本冲突。
- Chrome 桌面/375px：参数编辑、保存刷新恢复、JSON 导入导出、未保存取消、无效参数、生成503重试、保存503重试、409冲突提示和键盘增量输入通过。
- 下载 SVG 单独打开，DXF 用 dxf-parser 独立读取：200×100 mm 面板有4个直径6 mm孔，右侧孔中心185 mm，DXF INSUNITS=4。
- 深色/reduced-motion 已检查；页面异常、失败请求、外部资源请求、横向溢出均为0。人为注入的503/409是预期失败场景。
- 源包排除业务数据；Floatboat 客户端导入未验证。

上游 Apache-2.0 声明与范围见 NOTICE.md。未对整个总仓库另选许可证。
