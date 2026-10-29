# Promptfoo 评测台

在用例 × 提示版本 × provider 矩阵中找出退步，检查断言与输出，记录发布判断，导出完整评测报告。0.9.0 的本机评测不需要外部执行器或模型账户。

## 开始

使用 Node 22.16+（22.x）与 pnpm 10.22.0，从仓库根目录执行：

```sh
pnpm workbench prepare promptfoo
pnpm workbench dev promptfoo
```

打开打印的完整地址。首次使用载入 36 个中英文售后工单、3 个提示版本、2 个示例录制 provider 和一列规则脚本，共 252 格。录制输出是虚构手工示例。点击“运行评测”在本机重新评分；收紧断言后重跑，选择旧运行为基线，即可筛选退步并审阅。

“评测”菜单提供空白评测、最近评测、本机草稿、导入与导出。配置和复核自动保存，未完成 YAML 也会在刷新后恢复。

## 输入与交付

| 文件 | 行为 |
| --- | --- |
| YAML / JSON 配置 | 新建评测 |
| Promptfoo v3 结果 / v2 results 列表 | 加入当前评测，提供录制输出 |
| CSV / TSV | 追加测试变量与 __expected 断言 |
| 完整评测项目 | 新建评测，恢复全部运行、配置、复核和发布判断 |
| workbench-working-copy.json | 新建评测，恢复未生效输入；结果仍引用原本机资料 |

可导出 YAML、当前运行原始 JSON、逐格 CSV、自包含 HTML 发布报告和完整项目。单个文件最多 40 MiB / 20,000 结果格；结果原文独立存储。多运行完整项目若超过 40 MiB，需拆分再导入。单次运行最多 2,000 用例、24 提示、24 providers、6,000 格；其他容量见 [REQUIREMENTS](app/REQUIREMENTS.md)。

## 配置与运行

本机支持 echo、recorded:<provider> 回放、floatboat:script 规则脚本、21 类确定性断言、weight、threshold、metric、transform 和 assert-set。模板支持变量、过滤器、条件及循环的受限子集。模型评分断言保留并标为未执行，不能据此自动建议发布。

floatboat:<model> 通过 Host 运行真实模型，需要连接、授权及调用次数确认。“执行环境”显示状态和重新检查。**本轮真实 Host / LLM 未测**，只有 mock 合同验证。普通预览可能自动发现 Floatboat；离线工作可用 `FLOATBOAT_HOST_MODE=offline pnpm workbench dev promptfoo`。

回放匹配 provider 与完整渲染提示，改提示后缺少录制会明确报错；耗时/成本沿用录制数据。含 recorded:/floatboat: 的导出 YAML 需要本工作台或配套适配器，不能直接在未改造的官方 CLI 中运行。

## 可选官方核对

Node 22.22+（22.x），从仓库安装启动：

```sh
cd workbenches/59-promptfoo/service
pnpm install --frozen-lockfile --ignore-scripts
# 示例含 JavaScript 断言，仅对可信配置启用
PROMPTFOO_RUNNER_ALLOW_JS=1 pnpm start
```

另一终端从仓库根目录运行：

```sh
PROMPTFOO_RUNNER_URL=http://127.0.0.1:8770 pnpm workbench dev promptfoo
```

执行环境中点击“用官方 promptfoo 交叉核对”。固定 promptfoo 0.125.1，仅核对 echo/录制列和确定性断言，跳过 Host/本机脚本列，拒绝模型评分。可设置 PROMPTFOO_RUNNER_TOKEN，两进程需一致；默认监听 loopback。官方 JavaScript 不使用工作台沙箱，必须信任配置来源。

任务保存编号和输入，同编号重试不会重复执行，刷新继续查询；重启标为 interrupted，不自动重放。本机任务可停止，已完成的模型调用不能撤销；官方执行器尚无取消接口。

## 检查与包

工作台目录执行 `pnpm workbench:check`、`pnpm test`、`pnpm --dir service test`、`pnpm package`。包包含本机评测源码、依赖声明、示例和许可，不包含数据库、凭据或可选执行器。导入路径：Floatboat → 我的 → 工作台 → 导入工作台；本次未实际验证客户端导入。

详见 [验收](app/ACCEPTANCE.md)、[设计](app/DESIGN.md)、[工程边界](app/ENGINEERING.md) 和 [第三方材料](app/notices/THIRD-PARTY.md)。
