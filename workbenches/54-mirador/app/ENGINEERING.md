# 馆藏对照室工程记录

## 模块与数据

- contracts/folio.ts：20页/100条记录的领域约束、引用关系、视图、复核草稿、CSV文本转义。
- server/images.ts：PNG/JPEG头与尺寸、1MiB限制、SHA-256内容身份、资源读写、同源IIIF Presentation 3清单。用户原图经manifest声明的scans data资源管理；原创演示SVG在samples项目资源。
- server/store.ts：项目JSON、乐观revision更新与删除；server/routes.ts注册CRUD、图像上传/读取/导出及IIIF路由。项目JSON不包含原图字节，SQLite images表记录原图元数据。
- ui/Compare.tsx：官方Mirador 4.3.0动态加载与多窗口。订阅用户操作后的viewers状态，持续自动保存受限数值视图；选择资料页时清除该侧旧视图。移动端/响应式重建前捕获当前视图，卸载释放Mirador root。
- ui/files.ts：图像真实浏览器解码、串行上传、含原图的可移植JSON项目；先验证整个输入，再建立新的对照项目。
- ui/Reviews.tsx：页级复核状态与草稿。草稿也存于项目，参与dirty保护；CSV保护公式前缀并保留引号/换行。
- ui/App.tsx：页面与项目切换。共享hook保留保存成功/列表刷新失败的区别，保存冲突不覆盖编辑内容。

## 范围与运行

官方Mirador ES发布包，模板React19.2.3，固定Vite，无SDK/CSP/编译器修改。无外部图像代理、PACS/IIIF站点连接或Host模型业务，capabilities为空。上传JSON每次仅一张图像，符合模板2MB请求限制。原图不自动删除，以免破坏其他项目的共享引用；从完整项目包重复导入按哈希去重并可补回缺失文件。

JPEG/PNG每张1MiB、边长10000、3000万像素；原图格式完整性由浏览器解码，服务端检查头部、尺寸、base64规范和哈希。总项目包30MB。原图文件使用哈希路径；不接受任意路径、SVG上传或外部资源地址。项目原图默认不随.fbworkbench源包导出。

## 验收

pnpm workbench:check、pnpm test、pnpm package。15项测试覆盖领域引用/坐标视图、CSV转义、图像格式与资源字节、哈希、重开、版本冲突及IIIF链接。Chrome桌面/375px：真实双画布、PNG导入字节一致、旋转保存、草稿与复核记录、项目JSON往返、CSV、错误输入和取消保护、保存503重试及列表503、键盘、深色与reduced-motion。只有主动注入的503有console记录；无意外页面异常或外部请求。客户端导入安装尚未验收。


## 自动保存与原子性

使用统一autosave模块和0004迁移，完整工作副本在SQLite保存，IndexedDB作为同来源的本机缓存与恢复索引。restoreCollectionDraft仅放宽空页名，维持类型、大小、引用与资源标识校验。模型有效才进入projects表；响应丢失按mutationId重放，冲突不覆盖其他窗口。图片同hash完整文件跳过写入，修复/新增采用临时文件原子rename。Project JSON导入调用replace新建文档；不复用旧project.id。
