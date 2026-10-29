---
name: workbench-ledger
description: 维护工作台台账（飞书电子表格「工作台总览」）。在工作台开发、版本发布、商店上架/下架、测试反馈处理之后更新台账；当用户提到台账、工作台进度表、测试表、上架状态汇总时使用。
---

# 工作台台账

台账是飞书电子表格里的「工作台总览」子表，一行一个工作台，覆盖 `catalog.json` 的全部条目（含规划中）。开发、运营和测试人员共用这张表，每列只有一个负责方。

## 台账位置

本仓库公开，台账链接不入库。按以下顺序读取：

1. `node scripts/ledger.mjs sync --url <链接>`
2. 环境变量 `WORKBENCH_LEDGER_URL`
3. `.local/workbench-ledger.json`（已被 `.gitignore` 忽略）：`{"url": "https://…/wiki/…"}`

没有链接时向用户索取，不要自行搜索或新建表格。操作使用 `lark-cli`，身份为 `--as user`。授权失效时请用户运行 `! lark-cli auth login`。

## 列与负责方

| 列 | 负责方 | 更新方式 |
| --- | --- | --- |
| 编号、工作台、标识、开发状态、仓库版本 | 仓库 | `ledger.mjs sync`，来自 `catalog.json` 与 `app/manifest.json` |
| 最近变更 | 仓库 | 当前版本 manifest 的 `changelog` |
| 主要能力、已知限制 | 仓库 | catalog 的 `core_features`、`caveat` |
| 商店状态、商店版本 | 运营 | 商店审核、上架或下架后更新，见下文 |
| 测试结论、测试问题 | 测试人员 | **只读**。脚本和代理都不写这两列 |
| 下一步 | 共用 | 手工填写：待修复项、复测要求、下架原因 |

脚本按表头名找列、按「标识」找行。测试人员可以调整列顺序或在右侧加列；表头可带括注，例如「测试结论（Sheet1/Sheet2）」。不要改动脚本负责的表头文字。同一表格里的其他子表（如测试人员的 Sheet1、Sheet2）是原始测试记录，不要修改。

## 何时更新

- **合入工作台改动、提升版本、新增或改变 catalog 状态之后**：同步仓库列。
- **商店审核通过、上架、下架之后**：更新商店状态和商店版本，并在「下一步」写明原因（如「测试打不开，已下架；修复后重新提交审核」）。
- **处理测试反馈之后**：在「下一步」写处理结果和需复测的版本。测试结论由测试人员复测后自己改。

## 同步仓库列

```sh
node scripts/ledger.mjs sync            # 预览：逐格列出 旧值 → 新值，以及新增行
node scripts/ledger.mjs sync --apply    # 写入
node scripts/ledger.mjs sync            # 复查：应为 0 cell(s) changed
```

先预览，确认改动只落在仓库负责的列。catalog 新增的工作台会追加到末行，并沿用边框和换行样式。脚本不删除行。catalog 移除条目时，在「下一步」注明，并由用户决定是否删除该行。

## 更新商店列

商店列只反映后台的真实状态，不从仓库推断。有后台导出时，批量同步：

```sh
node scripts/ledger.mjs sync --store states.json          # 预览
node scripts/ledger.mjs sync --store states.json --apply
```

仓库列可能写着尚未合入 main 的分支进度（例如「0.9.0（本地分支）」、其他会话手写的变更摘要）。这时完整同步会把它们改回 main 的旧值。只想更新商店列时加 `--store-only`：只写商店状态、商店版本两列，台账里没有的工作台只列出、不新增行。

```sh
node scripts/ledger.mjs sync --store states.json --store-only          # 预览
node scripts/ledger.mjs sync --store states.json --store-only --apply
```

预览里出现预期之外的仓库列改动时，先确认对应分支是否已合入；未合入就用 `--store-only`，合入后再做完整同步。

`states.json` 是工作台商品数组：`[{"name": "<registryName>", "visibility": "listed" | "unlisted", "version": "<当前版本>"}]`。映射规则：

- `listed` → 已上架，并填写商店版本。
- `unlisted` → 已下架，商店版本留空。
- 不在导出中：仓库已开发的写「未上架」；`app/LICENSE` 不是 MIT 的写「未上架（非 MIT 许可）」。商店只收 MIT 包。
- 规划中 → 未开发。

导出文件只含商品名、可见性和版本。不要把后台地址、账号、集群信息或导出文件提交到仓库。只改了一两个商品时，可以直接改单元格：

```sh
lark-cli sheets +cells-set --url "$WORKBENCH_LEDGER_URL" --as user --sheet-name 工作台总览 \
  --range F2:G2 --cells '[[{"value":"已下架","cell_styles":{"background_color":"#FDECEA"}},{"value":""}]]'
```

改之前先读取该行，确认行号对应的「标识」。商店状态底色：已上架 `#E8F5E9`、已下架 `#FDECEA`、未上架 `#FFF4E5`、未开发 `#F2F3F5`。

## 验收

- 写入后用 `lark-cli sheets +csv-get … --range A<行>:M<行>` 回读改动行。全量同步后再跑一次预览，应为 0 个改动。
- 改动前后测试结论、测试问题两列内容一致。
- 向用户汇报时，引用的状态数字要来自回读结果或后台查询，不要来自记忆。
