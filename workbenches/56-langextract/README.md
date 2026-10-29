# LangExtract · 证据书桌

将 LangExtract 的抽取结果变成可校对的记录：点击字段回看原文、接受或驳回、保留修订和依据，再交付审校表。原文纸页与记录账本并排，自动保存完整工作稿。

## 已实现

- **资料批次**：1–40 份资料，粘贴原文、添加 .txt/.md 文件，或导入 LangExtract `AnnotatedDocument` JSONL / JSON 数组 / 完整工作稿；横向资料条显示每份复核进度。首屏是 5 份采购资料的示例批次（人工编制，非模型输出）。
- **抽取配方**：任务说明、类别定义（含义与属性名）、结构化 few-shot 示例；按 LangExtract 的做法检查示例片段是否逐字出现在示例原文中；可预览实际提示词。
- **Floatboat 模型通道**：`llm.generateText`，按 LangExtract 的 Q/A few-shot 格式逐段（约 1800 字符）提示；输出解析与原文区间对齐（精确 → 规范化 → 模糊 ≥0.75，否则未定位）全部在 Node 内完成。任务输入先落盘，同一标识不重复调用模型；结果另开为新批次。
- **无模型也能完成主任务**：选中原文即标注为某类别；修改类别、值和属性；把记录重新定位到选区或自动对齐未定位记录；接受 / 驳回 / 修订 / 笔记，键盘 J/K/A/X。
- **类别统计**：类别 × 状态（待复核、接受、修订、驳回、未定位）与逐份资料进度。
- **导出**：审定结果 JSONL（LangExtract 格式，含最终类别/值/区间）、可视化审校页 HTML（自包含、无脚本）、审校表 CSV、原始抽取 JSONL（模型原样，不含人工标注）、完整工作稿 JSON。
- **LangExtract Python 服务（可选）**：独立的 `langextract==1.7.1` 服务仍可用，抽取面板内显示其状态、启动命令与“重新检查”。
- SQLite 自动保存、IndexedDB 本机恢复、延迟保存不阻挡编辑、幂等重试与版本冲突保护；导入一律新建批次。

**验证边界：**本地编辑、标注、导入导出、自动保存与 Host 通道合同（mock）已验证；**真实 Floatboat Host / 模型调用未测**；Python 服务沿用 0.4 的契约验证，本轮未连真实模型。Floatboat 客户端导入未实测。详见 [验收记录](ACCEPTANCE.md)。

## 运行

仓库根目录：

```sh
pnpm workbench prepare langextract
pnpm workbench check langextract
pnpm workbench test langextract
pnpm workbench dev langextract
pnpm workbench package langextract
```

预览有真实 SQLite 数据；界面会自动恢复当前批次。Floatboat 运行时，抽取面板的“Floatboat 模型”通道自动可用；不想连接时用 `FLOATBOAT_HOST_MODE=offline pnpm dev`。导出包位于本项目 `artifacts/`，在 Floatboat「我的 → 工作台 → 导入工作台」导入。源包默认不含预览数据和 Python 服务。跨机器移动批次请用“完整工作稿 JSON”。

## 可选：LangExtract Python 服务

在此项目目录创建隔离 Python 环境。`requirements.lock` 是本次 Python3.12 环境的精确依赖快照；其他系统先验证兼容性。

```sh
uv venv service/.venv
uv pip install --python service/.venv/bin/python -r service/requirements.lock
```

两个进程使用同一段至少16字符的随机连接密钥；不要把密钥写进项目、JSONL 或 Git。先在服务终端设置：

```sh
export LANGEXTRACT_SERVICE_TOKEN='<自行生成的随机连接密钥>'
export LX_MODEL_ID='<LangExtract 支持的模型 ID>'
export LANGEXTRACT_API_KEY='<模型提供方密钥>'
export LX_JOB_DATABASE='service/.local/jobs.sqlite'
service/.venv/bin/python service/server.py
```

默认监听 `127.0.0.1:8767`。Ollama 路线使用 `LX_MODEL_URL` 指定已部署服务，并选择其实际模型 ID；模型权重、显存和许可由该服务管理。此版本未代替用户安装模型。Python 服务一次最多 8 份资料、每份 3 万字符；更大的批次请用 Floatboat 模型通道或拆分。

在启动 Node 预览的终端设置：

```sh
export LANGEXTRACT_SERVICE_URL='http://127.0.0.1:8767'
export LANGEXTRACT_SERVICE_TOKEN='<与 Python 服务相同的连接密钥>'
pnpm dev
```

导入 Floatboat 后，这两个变量也需提供给实际工作台服务器进程；本版没有在界面保存服务凭据的设置页。远程服务必须经 HTTPS 并保持 Bearer 鉴权；不要把无 TLS 的远程地址填入配置。未配置服务时，本地资料审校仍可用。

抽取时先保存当前项目，再提交原文、字段与已应用示例。刷新不会自动提交新任务；不确定的提交通过原 ID 查询。服务重启中断的任务需要用户明确新建；停止接收结果不能保证供应方已经取消计费。

## 输入与导出约定

每行 JSONL 包含 `document_id`、`text` 和 `extractions`；记录支持 `extraction_class`、`extraction_text`、`char_interval`、`attributes`、`alignment_status` 等上游字段。区间为 Python Unicode 码点、左闭右开。人工层（复核类别、值、属性、区间锚点、来源）与上游记录分开保存，0.4 的项目文件可直接打开。

正式批次保存上限 880KB（共享存储拒收 900KB 以上的项目）；超出部分作为工作稿保存：数据 1.35MB、未应用编辑器与待提交任务 450KB、整体 1.85MB。文件读取上限 8MB。不解析扫描件或 PDF。

## 许可与上游

[LangExtract](https://github.com/google/langextract) 代码为 Apache-2.0；本工作台通过独立 Python 服务调用，不在前端复制上游内联 HTML。模型服务与权重许可单独适用。上游对健康相关用途另有条款，本版示例和用途为非医疗资料抽取。来源及许可记录见 [notices](notices/README.md)。
