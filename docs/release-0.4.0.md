# 0.4.0 AI 工作台验收

日期：2026-10-27。本批新增6个独立工作台，仓库共32个完成本地功能验收、29个计划项目。六项都包含自动保存、可恢复工作稿、人工编辑/复核和导出；模型与独立服务的真实执行范围分别记录。既有26项仍为0.3.0，本批未修改其业务源码或重跑其全部验收。

六个Git worktree分批并行，五个实现子代理与主线程分别负责产品；集成时另做独立只读审查和针对性修复。没有改动固定模板SDK、tooling或CSP。模板仍固定在 `3b55d46f7ae25e939ce3299073c37ed334d69c02`。

## 检查结果

主仓库完成 **6项构建、106项应用测试、14项独立服务测试、3项工具测试及6个源码包**。应用测试总数采用最终Presenton修复后的29项；主仓库整批检查后，对其修复重新检查、测试和打包。Docling的应用包版本也已对齐0.4.0并重新检查/打包。

| 工作台 | 应用测试 | 服务测试 | 已验证的本地工作流与真实上游范围 |
| --- | ---: | ---: | --- |
| [LangExtract](../workbenches/56-langextract/ACCEPTANCE.md) | 17 | 7 | JSONL证据定位、修订、导出；真实LangExtract管线使用明确stub provider，**不是模型推理** |
| [Docling](../workbenches/57-docling/app/ACCEPTANCE.md) | 23 | — | 结构/文本/表格校订、顺序、导出；真实Docling core转换HTML并回读校订JSON |
| [LangGraph.js](../workbenches/58-langgraph/ACCEPTANCE.md) | 11 | — | 真实StateGraph运行、中断、人工复核、SQLite检查点及进程重启恢复 |
| [Promptfoo](../workbenches/59-promptfoo/ACCEPTANCE.md) | 11 | 3 | 真实结果矩阵、基线、人工复核；真实Promptfoo evaluator回显评测及Node执行器 |
| [faster-whisper](../workbenches/60-faster-whisper/ACCEPTANCE.md) | 15 | 4 | 音频保存/回听、字幕编辑/导出；真实tiny.en CPU INT8转写，主仓库再次完整验证 |
| [Presenton](../workbenches/61-presenton/app/ACCEPTANCE.md) | 29 | — | 大纲/逐页审阅/导出、持久制作记录；官方异步API与下载的合同测试，live生成未验证 |

服务测试数字包括边界/队列/HTTP合同验证，不代表相同数量的模型调用。Docling和Presenton的HTTP fixture测试计入应用测试，未算作真实上游运行。所有六项均运行了真实Chrome主任务与响应式检查，截图为浏览器原图。

环境：Node22.22.2、pnpm10.22.0、Python3.12.13、Chrome headless。部分单页及共享自动保存模块触发体积提示，未压制检查；没有类型、构建或测试失败留待发布后处理。

## 自动保存与运行状态

除了普通编辑/刷新，本批验证：保存响应延迟期间继续输入；服务已提交但回执丢失后的同mutation重试；未完成JSON/日期/字幕时间草稿；新项目导入不覆盖旧项目；两窗口冲突和本机恢复；完整项目与普通导出。正式模型和工作稿采用不同边界，达到模型容量后仍可恢复、导出和导入工作稿。超出工作稿或传输容量时明确提示，不能显示成服务器已保存。

集成审查修复并回归了以下边界：

- LangExtract服务响应必须对应原任务ID和输入来源。
- Promptfoo任务终态不能被迟到提交/轮询覆盖；未确认操作阻止无提示新建；新报告校准基线列。
- Promptfoo数据型字段拒绝环境模板、文件/包/外部提示引用；固定套件只保留声明的字面数据与简单变量，实际调用上游前进行验证。
- LangExtract、Docling、Promptfoo、faster-whisper及Presenton工作稿独立恢复，便携文件包含未完成编辑输入。容量回归覆盖真实SQLite关闭重开、浏览器刷新和导入往返。
- faster-whisper取消/完成状态不会被迟到结果复活，远程服务要求HTTPS，响应大小限制后关闭读取。
- Presenton在提交前持久化本地操作；丢回执且列表/详情查询失败时仍保留未知状态，刷新后按原ID核对。再次制作需要明确确认。便携/恢复导入不再清除未完成JSON。

这些是应用内恢复保证；未宣称任意第三方模型请求可以exactly-once计费。关闭页面或停止本地跟踪也不等于取消上游已发出的推理。IndexedDB仅在同一浏览器来源内恢复，跨端口、设备或安装应使用合适的便携文件/数据迁移。

## 上游与交付边界

- **LangExtract**：真实模型提供方尚未配置/验证；可使用本地JSONL资料审校。没有Host→Python provider bridge。
- **Docling**：本版上传HTML；校订DoclingDocument JSON。没有实现PDF/DOCX上传或预览、OCR和视觉模型；官方Serve live往返未验证。
- **LangGraph**：填写资料模式实际执行核心库。Host模型分支已实现，当前Host断开，未取得真实成功输出。
- **Promptfoo**：真实运行的是回显提供者及断言，不是模型效果测试。模型模式需要在独立执行器配置提供方。
- **faster-whisper**：只验证tiny.en英语短录音、CPU INT8路线。其他语言/模型、GPU、长录音质量与容量不作已验证承诺。服务锁定PyAV16.0.1以匹配faster-whisper1.2.1。
- **Presenton**：当前本地大纲与文稿流程可用。真实生成、上游PPTX/PDF渲染与文件递送需配置独立服务后验证；目前的HTTP fixture不代表真实文件生产链路。

六个源码包均未经过Floatboat客户端导入验收。Python、模型、独立执行器、提供方凭据和预览数据不随普通源码包打包；后端部署步骤见[AI服务说明](ai-services.md)及各项目README。

## 代码与截图

产品结构分别为证据书桌、结构校样、三站复核、评测矩阵、字幕音轨和逐页演示舞台。各目录的 `app/DESIGN.md` 和 `app/ENGINEERING.md` 记录选择；React与Web界面规则已应用。截图、版本、尺寸和摘要见[截图清单](screenshots/README.md)。

主仓库的批量命令可重跑：

```sh
pnpm batch check --from 56 --to 61
pnpm batch test --from 56 --to 61
pnpm batch package --from 56 --to 61
pnpm test:tooling
```

批量日志保存在忽略的 `.cache/batch/`。公开源码只包含普通示例和验收结论；真实用户数据、模型缓存、测试临时库与连接配置没有入库。
