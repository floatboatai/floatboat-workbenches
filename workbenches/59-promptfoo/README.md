# Promptfoo 评测台

把 Promptfoo 的评测结果变成可复核的发布依据：用例×提示版本矩阵、失败断言、基线输出比较、人工判断与审阅意见。项目、完整测试配置草稿和报告自动保存到本机 SQLite；导入项目创建新项目。

## 使用

从仓库根目录执行：

```sh
pnpm workbench prepare promptfoo
pnpm workbench dev promptfoo
```

可以直接导入 Promptfoo v3 summary 或带 `results` 外层的 CLI JSON。每份结果限600KB、400个单元格，整个工作项目限750KB。通过/失败筛选、复核意见、原始JSON和CSV导出不要求模型服务。页面示例由真实 Promptfoo 0.125.1 回显提供者产生，含3个通过/1个失败；它验证评测过程，不是模型效果示例。

## 运行评测

执行器独立运行，不属于工作台 Node 纯JS运行包。需要 Node 22.22.0+（22.x）：

```sh
cd workbenches/59-promptfoo/service
pnpm install --frozen-lockfile --ignore-scripts
pnpm start
```

另一个终端从工作台目录启动：

```sh
PROMPTFOO_RUNNER_URL=http://127.0.0.1:8770 pnpm dev
```

默认回显模式 `echo` 在实际 Promptfoo evaluator 中执行模板与断言；`model` 模式需要执行器进程配置 `EVAL_MODEL_URL`（完整 Chat Completions URL）、`EVAL_MODEL_NAME`，按供应商需要配置 `EVAL_MODEL_KEY`。模型密钥只保存在执行器的服务环境中，不输入工作台、不进入项目导出。执行器可用 `PROMPTFOO_RUNNER_TOKEN` 保护，工作台进程设置同名变量；默认只监听127.0.0.1。远程部署需HTTPS、鉴权和自有反向代理，浏览器始终调用工作台同源API。

执行器接受限定JSON：`mode`、`description`、`prompts: [{label,raw}]`、`tests: [{vars,assert}]`。提示只接受所有用例均已声明的 `{{变量名}}`；变量、断言、名称仅接受字面文本，拒绝环境模板和 file/package/portkey/langfuse/helicone 等引用；支持contains/not-contains/equals/is-json；不加载上传的脚本、插件、文件、任意provider或transform。一个任务最多25用例×4版本，执行器串行处理任务、每个评测最多2个并发请求。

提交前保存操作ID。执行器SQLite按同一ID及输入摘要去重；丢失回执可查询/重试同一任务。刷新重新查询原ID，不重跑模型。重启中断的任务明确标为interrupted。当前版本不提供执行中取消；关闭页面不会撤销已经提交的推理。完成结果加入新的报告版本，人工复核不会被生成内容覆盖。

## 文件与验证

- `app/`：固定模板应用，声明了普通示例JSON资源。
- `service/`：独立Promptfoo执行器和锁定依赖；使用同项目契约文件，启动需保持仓库目录结构。
- `.local/`：忽略的运行数据，默认不进入源码包。
- `ACCEPTANCE.md`：实际构建、测试、浏览器与服务验证范围。

`.fbworkbench` 包包含工作台源码，不安装或启动外部执行器。需要执行功能的接收方也应从本仓库准备上述 `service/`。Host LLM与平台客户端导入单独记录，不将OpenAI-compatible服务冒称为Floatboat Host。

## 上游与许可

[Promptfoo](https://github.com/promptfoo/promptfoo) / [Node API](https://www.promptfoo.dev/docs/usage/node-api-reference/) / [MIT许可](https://github.com/promptfoo/promptfoo/blob/0.125.1/LICENSE)。本工作台复用结果格式，并在独立服务中执行锁定的promptfoo 0.125.1；没有复制整个上游前端。保留上游版权与许可，模型服务条款和依赖分别适用。根仓库尚未选择覆盖全部工作台的统一许可证。

超过750KB模型容量的复核输入保留为可恢复草稿（上限1.3MB）；草稿JSON可导出、导入新项目，整理或拆分后再成为已保存模型。
