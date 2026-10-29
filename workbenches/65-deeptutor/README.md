# 课程练习册 · DeepTutor

把一份讲义变成能反复练的课程：左页讲义，右页一次一道题。作答、核对、看解析，答错时请Floatboat导师针对自己的答案讲解并追问，再选复习等级排进错题/到期复习清单。讲义、未提交答案、导师讲解、课堂笔记和题库原文自动保存。

![课程练习册](../../docs/screenshots/deeptutor.png)

## 启动

```sh
pnpm workbench prepare deeptutor
pnpm workbench dev deeptutor
```

不需要再启动任何服务。判题、复习排程和题库导入由工作台自己的Node服务完成（DeepTutor练习模块的TypeScript移植，见下文）；没有Floatboat客户端时它们照常可用。

只有两个动作使用已连接的Floatboat Host模型（manifest已声明`llm`，默认`gemini-3.8-flash`，凭据与路由由Host管理，没有密钥输入框）：

- **请导师讲解**：核对后针对学习者的答案、讲义和题库解析给出讲解，可继续追问；对话按题保存在课程里，随导出/导入往返。
- **根据讲义出题**：题数1–12、题型（混合或单选/多选/判断/填空/简答）、难度（由浅入深/基础/理解/应用），并把已有题干交给模型避免重复。结果先进入独立任务账本，经DeepTutor题库规范化后在左页审题，再“追加到练习册”（保留作答与复习）或“替换整套题”。

Floatboat未连接时，这两个按钮旁显示启动说明和“重新检查”，其余功能不受影响。

## 首屏与结构

示例课程“Python · 函数与集合”：四节讲义（含代码示例）和12道题，覆盖单选、多选、判断、填空、简答。顶部一行文件条：“课程”书架（新建、最近课程、导入课程/工作稿、导出）、课程名与安静的保存状态、复习进度、“题库”。题号条用颜色表示未练/答对/待巩固/到期，并可按错题、到期筛选。375px时以“练习/讲义”切换单页，默认先练习。

## 范围

- DeepTutor `importing.py`、`answers.py`、`scheduler.py`（锁定提交`a31d826`）移植为`app/src/contracts/deeptutor/`；`reference/`保留原始Python文件、许可与对照数据生成器，`app/tests/parity.test.ts`要求移植结果与Python逐项一致（含题目身份哈希）。0.5.0及更早由Python服务生成的题目身份保持不变。
- 题库：JSON数组，或带表头的CSV/TSV（中英文列名、A–J选项列、自动识别逗号/分号/制表符），UTF-8或GB18030。单次最多500题（上游上限）、原文1.5MB（工作台请求上限2MB）、规范化题库700KB；任一行不合格或重复时整批不导入并逐行列出。XLSX需另存为CSV（上游依赖openpyxl，未移植）。
- 客观题由移植的`check_answer`判定；填空、简答及无法可靠判定的题显示参考答案由学习者自评，不伪造分数。复习等级调用移植的SM-2式`schedule`，按钮上预览每个等级的下次间隔；固定操作ID让丢回执重试不重复计数。课程最多2000条复习事件。
- 模型出题与导师讲解只处理明确提交的讲义与题目；生成任务未确认失败时不自动重发，导师讲解失败可手动重试。

没有教材PDF解析/RAG、长期学生记忆、任意Agent工具执行、班级或学校账号。

## 验证与打包

```sh
pnpm workbench check deeptutor
pnpm workbench test deeptutor
python3 -I workbenches/65-deeptutor/reference/make_parity_fixtures.py   # 可选：重新生成Python对照数据
pnpm workbench package deeptutor
```

导入路径：Floatboat → 我的 → 工作台 → 导入工作台。`.fbworkbench`包不含开发数据库或模型凭据，也不再需要单独启动服务。客户端导入尚未实测。验收与真实Host范围见[ACCEPTANCE.md](ACCEPTANCE.md)。

上游：[HKUDS/DeepTutor](https://github.com/HKUDS/DeepTutor)，Apache-2.0；CSV嗅探与读取按CPython 3.12 `csv`移植，PSF许可。许可文本在`app/notices/`。

恢复：书架中的“导出工作稿”生成完整恢复文件；导入总是新建课程，旧生成/复习操作只作为导入记录保留，不自动重放。新建、打开与导入期间锁定编辑，待旧工作稿保存完成后切换。
