# 工程说明

contracts/drawing.ts 定义并验证固定模板参数。server/geometry.ts 使用 makerjs 0.19.2 计算模型、路径长度、SVG 与 DXF；server/index.ts 暴露同源 /api/render；routes/store 负责 SQLite 项目版本与冲突。

UI 保留当前编辑参数，以其序列化签名匹配渲染响应；延迟请求和过期响应守卫避免旧结果覆盖。SVG 仅由服务器已校验数值和固定模板生成，SVG 不含用户文本、外链或脚本。JSON 文件导入完整验证后才替换状态；预览与几何导出禁用直到最新计算完成。

发布包为纯 JS，Node 22 计算无需原生模块、WASM、浏览器 worker 或任意代码执行。React 无需加载 Maker.js。manifest 不声明模型能力。check/test/浏览器和源包验证分别记录在项目 README。

## 0.2.0 工作草稿

使用公共 autosave contracts/client/cache/requests/server，追加独立迁移，不改原迁移。`documentId` 与 `mutationId` 去重；草稿 revision 与项目 revision 分别验证。UI 用 `documentKey`/`loadEpoch` 表示文档切换，后台保存不换 key。额外输入放 `draft`；宽松但限定类型的恢复器允许业务校验尚未通过的编辑值。
