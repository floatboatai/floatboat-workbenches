# DeepTutor模块集成

`src/contracts/deeptutor/`是DeepTutor `deeptutor/services/practice/`（锁定提交`a31d82624c27d75f4e771d4fcb78dce16470b383`）三个模块的TypeScript移植：`importing.ts`、`answers.ts`、`scheduler.ts`。为保证题目身份哈希和判定逐字节一致，`pycompat.ts`实现所需的Python语义（`str()`、Unicode空白、按码点长度/排序、`json.dumps(sort_keys, ensure_ascii=False)`、`round()`的精确半偶舍入、JSON整数/浮点区分），`csv.ts`移植CPython 3.12的`csv.Sniffer`与reader状态机。原始Python文件、许可和对照数据生成器在`../reference/`；`tests/parity.test.ts`对18个题库、27次判题、15次排程和DST日界限与Python输出逐项比较。已知差异：JSON中的`NaN`/`Infinity`字面量会被拒绝；整数键选项顺序遵循JS对象规则。

`src/server/practice.ts`替代0.5.0的loopback Python适配器，保留其校验（答案≤5000字、复习状态字段与范围、时间与操作ID、题目身份核对）并把上游英文错误转为中文。`/api/practice/import`对行错误返回逐行列表而不是部分导入。浏览器只导入纯函数`scheduler.ts`用于预览评级间隔；服务端才执行规范化（使用`node:crypto`）。

`src/server/prompts.ts`构造出题与导师提示；`generation-routes.ts`中`POST /api/tutor`同步调用`app.host.llm.generateText`（requestId为操作ID，90秒超时，要求`STOP`），`HOST_NOT_CONNECTED`转为带启动说明的错误。出题仍使用SQLite账本`tutor_generations`（未新增迁移）：输入JSON新增`options`与`avoid`，旧行按0.5.0的3题混合题型解释，旧客户端只传lesson/goal时保持原输入字节以维持幂等。

`src/contracts/tutor.ts`中课程新增`tutoring`（按题的讲解对话，旧课程缺省为空），题库上限500题/700KB、复习事件2000条、正式课程900KB与工作稿1.9MB。共用autosave/requests文件未改动；文件导航（课程书架）、对页布局与样式由本应用维护。
