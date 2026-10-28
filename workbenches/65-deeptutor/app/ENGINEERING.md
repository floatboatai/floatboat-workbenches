# DeepTutor模块集成

service/upstream中的importing.py、answers.py、scheduler.py为锁定提交的原始DeepTutor实践模块，许可证和来源单列；不修改其算法。service/server.py是本机只读/纯计算适配器：题库预览、客观判题与复习计划返回，无账号或用户浏览器读取。
app/src/contracts/tutor.ts定义课程、题目与完整工作稿；每题答案和复习事件持久化。UI区分客观检查、自评与复习等级。导入采用规范化后的题库，导出遵循上游字段，完整项目另外保留工作草稿。
Host生成请求在Node端登记SQLite账本，operation ID+输入去重，结果落库后交付。刷新只查询已知操作，不自动重发不确定模型调用；服务重启把运行中标记为中断。默认gemini-3.8-flash，严格完整JSON和STOP完成状态。模型只处理明确提交的讲义。
共用仓库自动保存与缓存实现，模型/题库候选单独保留并明确采用；不覆盖其他课程。固定SDK/tooling/CSP不变。
