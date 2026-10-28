# HyperFrames 实现

`contracts/movie.ts`定义受限镜头模型、工作草稿与严格渲染校验，生成SVG和合法HyperFrames composition HTML；所有作者字符串做XML转义，色值受限。WAAPI动画由HyperFrames官方运行时逐帧seek。

`ui/useMovieDesk.ts`处理项目与任务生命周期，`App.tsx`组织胶片、舞台和时间轴，`MovieInspector.tsx`编辑镜头。共用已有autosave-client/cache和SQLite草稿机制，保留未应用JSON。`documentKey`隔离异步响应与编辑器状态。

`server/routes.ts`提供项目与渲染API；`0004_renders.sql`保存任务输入快照，转发前落盘。已提交但回执不明标unknown，刷新查询远端任务，不自动重复提交。独立renderer/server.mjs使用持久JSON任务记录、同ID同输入幂等，启动时把旧running/queued改为interrupted，取消阻止迟到结果变为成功。

渲染器仅监听loopback，拒绝浏览器Origin；只有预定义composition和固定CLI参数，不接受命令行、路径或任意脚本输入。远程工作台服务地址需HTTPS，可配置服务token。视频默认不随工作台源包，服务数据存renderer/.local/jobs，可通过HYPERFRAMES_RENDER_DATA显式配置。Node/Chrome/FFmpeg由操作者安装。

应用check/test/package与renderer契约测试分开运行；真实CLI及浏览器证据见项目ACCEPTANCE。固定SDK、CSP和工具链未改动。manifest不声明未使用的Host模型能力。

提交前将operation ID、项目ID与输入快照写入自动保存草稿并等待确认；未确认期间保留pending，重试使用相同编号/快照，导航或导入不会丢掉未确认任务。终态确认后清理pending。导入携带运行信息的工程需明确确认只创建编辑副本，不重放原运行。

render-state模块对响应身份/状态验证并实现单调状态归并，服务端读取当前SQL状态后同步更新，阻止迟到响应复活终态；前端列表请求有序号并按终态归并。独立渲染器storage写入队列串行化每个任务，采用唯一临时文件与原子rename。
