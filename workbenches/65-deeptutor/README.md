# 课程练习册 · DeepTutor

把一份讲义变成可持续复习的课程：题库导入或模型出题、作答、客观核对、主观自评、错题与下一次复习安排。讲义、未提交答案、课堂笔记和题库编辑草稿自动保存。

![课程练习册](../../docs/screenshots/deeptutor.png)

## 启动

```sh
pnpm workbench prepare deeptutor
pnpm workbench dev deeptutor
```

另开终端启动练习核心服务（Python3.12，只有标准库；上游三个模块已随仓库固定）：

```sh
python3 workbenches/65-deeptutor/service/server.py --port 8786
```

工作台服务可设置`DEEPTUTOR_PRACTICE_URL`，默认`http://127.0.0.1:8786`，允许loopback HTTP或HTTPS。通过Node同源路由调用，浏览器不直接访问Python端口。

“根据讲义出题”使用已连接Floatboat Host，默认`gemini-3.8-flash`。生成题目先存入独立任务账本，经DeepTutor原生题库规范化，再由用户审题采用。没有模型提供方密钥输入框；凭据和模型路由由Host管理。

## 范围

- 真实复用DeepTutor的`importing.py`、`answers.py`、`scheduler.py`，锁定提交和原始文件见[来源](service/upstream/SOURCE.md)。不是全套DeepTutor服务的重部署。
- 题库JSON、UTF-8 CSV/TSV；最多100题、规范化题库350KB。部分题目非法或重复时拒绝整批，保留原文供修正。
- 客观选择题由上游判定；简答及无法可靠判定的题只展示参考答案，由学习者自评，不伪造分数。
- 原生题库导出能回读DeepTutor；完整课程另含讲义、当前答案、笔记、复习计划和未完成JSON。
- 复习使用上游SM-2式调度。固定操作ID、时间和输入让丢回执重试不重复增加复习次数。最多500条课程复习事件，达到容量时导出后新建课程。
- Host任务提交前保存操作；重复提交同ID同输入只核对已有任务。进程中断或模型失败不自动重发。导入课程创建新项目，保留题库草稿/已完成候选，清除原安装的运行关联，不重放生成或复习。

没有完整教材PDF解析/RAG、长期学生记忆、任意Agent工具执行、学校账号或班级管理。讲义以文本输入；首版模型每次生成3题，内容需人工核对。

## 验证与打包

```sh
pnpm workbench check deeptutor
pnpm workbench test deeptutor
python3 -m unittest discover -s workbenches/65-deeptutor/service -v
pnpm workbench package deeptutor
```

导入路径：Floatboat → 我的 → 工作台 → 导入工作台。普通`.fbworkbench`包不含Python服务环境、开发数据库或模型凭据；项目中的服务需单独启动。客户端源包导入尚未实测。验收与真实Host范围见[ACCEPTANCE.md](ACCEPTANCE.md)。

上游：[HKUDS/DeepTutor](https://github.com/HKUDS/DeepTutor)，Apache-2.0。保留原始模块和许可；未更改上游判题/调度算法。

恢复：支持“导出工作稿”的完整恢复文件，优先采用最新snapshot并保留未应用extra。导入总是新项目；旧执行关联仅作历史记录，不自动重跑。新建、打开与导入期间锁定编辑，待旧工作稿保存完成后切换。
