# PageIndex 0.5.0 验收

完成日期：2026-10-28（America/New_York，测试从10月27日晚开始）。固定模板3b55d46，Node22.22.2、pnpm10.22.0、Python3.12.13、真实Chrome headless。

## 已通过

- manifest/锁文件/类型/构建通过。业务界面拆成App、ReviewPane、DocumentPage与useReader；保留共享autosave-client的体积提示。
- 9项应用测试：真实PageIndex原生索引字段及页序往返、异常/重复/过深节点、草稿与容量、JSON围栏与截断、逐字引用、持久任务幂等、失败/重启中断不重发、文档来源绑定和SQLite乐观冲突。
- 4项Python测试实际调用PageIndex 0.2.10 Flash和PDFium：真实3页PDF索引及PNG、坏编码/非PDF拒绝、无文本PDF不伪造索引、41页容量拒绝。
- 真实Chrome主流程8项＋补充7项：章节与原页、便笺/页位置刷新恢复、真实Gemini 3.8两阶段章节选择和原页回答、逐字引用、无效JSON草稿、完整PDF项目导出/导入新项目且不重放历史问答、375px阅读/目录/审阅与键盘、无pageerror。
- 补充包含：PNG实际解码成功（naturalWidth>0）；保存回执延迟期间继续输入；服务已写但回执丢失后同mutation恢复且项目数不增加；两窗口冲突不覆盖服务器；导入保留无效JSON；窄屏原页和便笺均可用。
- 原PDF与索引存在工作台资源/SQLite中，停止并重启预览后恢复同一文档。渲染服务重启后仍可读取保存的PDF并产生PNG。
- 源码包成功，CRC、版本、源码/资源字节及许可检查通过，排除预览数据库、问答记录和Python环境。

## 真实调用与修复

普通自制示例为Harbor Workshop操作手册。Gemini 3.8实际选择第三章，回答闭馆检查与照片附件，引用经工作台对原页文本逐字核对。模型请求的requestId必须是UUID，初验发现带阶段后缀会被Host拒绝，已改为每次Host调用独立UUID，并补协议回归；工作台任务编号仍稳定且持久。初版Blob图像被模板CSP拦截，改为允许的PNG data URL，新增实际解码检查与重新截图；没有改SDK或CSP。

## 范围与未覆盖

PDF最多8MiB/40页/30万原文字符/250章节。原生Flash关闭模型摘要和优化，真实模型提问由工作台接Host完成，不冒称PageIndex Cloud或完整SDK检索代理。一次提问至多12页与45000原文字符，最多15次提问、60条便笺。没有OCR、任意超长报告质量或模型稳定性承诺。

非正常完成的模型输出和不匹配引用会保留失败记录；未知提交保留原操作，显式核对；没有自动重放不明模型调用。导入把未确认记录保留为历史，不执行。客户端源码包导入未实测，Python服务须单独启动。工作台不保存Host凭据与模型元数据。

## 界面复核

App.tsx、ReviewPane.tsx、DocumentPage.tsx和style.css按Web Interface Guidelines检查：字段标签、原生按钮、焦点、错误恢复、375px布局、reduced-motion、原页实际显示与来源对应通过。截图使用普通示例，等待已自动保存。详细时间、截图摘要与包信息见[acceptance-evidence.json](acceptance-evidence.json)。

## 恢复与切换补验

2026-10-28：真实Chrome验证实际恢复稿下载→作为新项目导入→刷新；保留便笺和未应用JSON，历史未确认提问不重放。用明确404合同模拟目标缺少原件，补齐相同PDF后原页图像成功解码且便笺不变。延迟旧项目保存回执期间，新建锁住全部编辑控件，确认旧便笺入库后才切换。4项补验和9项应用测试通过。
