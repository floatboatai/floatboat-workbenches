# LangExtract · 证据书桌

将 LangExtract 的抽取结果变成可校对的记录：点击字段回看原文、接受或驳回、保留修订和依据，再交付审校表。原文纸页与记录账本并排，自动保存完整工作稿。

## 已实现

- 导入 LangExtract `AnnotatedDocument` JSONL、JSON 数组或完整项目；一次1–8份资料。
- 按 Python Unicode 字符区间定位中文与 emoji；未定位和原文变更明确提示，不伪造定位。
- 接受、驳回、修订值、复核笔记与状态筛选；保留上游原始抽取和人工修订两层数据。
- 编辑原文、字段定义、抽取要求和 few-shot 示例；无效 JSON 作为草稿保留。
- SQLite 自动保存、IndexedDB 本机恢复、延迟保存不阻挡编辑、幂等重试与版本冲突保护。
- 导出原始 JSONL、审校 CSV、完整项目 JSON；导入创建独立项目。
- 独立 Python LangExtract 服务与 Node 同源连接器，保存任务快照和标识，查询、恢复状态及停止接收结果。完成的结果另开为新项目。

**验证边界：**本地编辑/导入/导出与自动保存已通过 Chrome 验收；实际 `langextract==1.7.1` 的 grounding/JSONL 已以显式 stub model 做契约检查。Node→Python 真实 HTTP、鉴权和未配置模型状态已验证。没有调用真实模型提供方；没有把样例或 stub 当作 AI 输出。Host 与 Floatboat 客户端导入未实测。详见 [验收记录](ACCEPTANCE.md)。

## 运行

仓库根目录：

```sh
pnpm workbench prepare langextract
pnpm workbench check langextract
pnpm workbench test langextract
pnpm workbench dev langextract
pnpm workbench package langextract
```

预览有真实 SQLite 数据；界面会自动恢复当前工作稿。导出包位于本项目 `artifacts/`，在 Floatboat「我的 → 工作台 → 导入工作台」导入。源包默认不含预览数据和 Python 服务；服务需独立运行。已有项目跨机器移动请使用“完整项目 JSON”。

## 配置实际抽取服务

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

默认监听 `127.0.0.1:8767`。Ollama 路线使用 `LX_MODEL_URL` 指定已部署服务，并选择其实际模型 ID；模型权重、显存和许可由该服务管理。此版本未代替用户安装模型，未提供 Host→Python provider bridge。

在启动 Node 预览的终端设置：

```sh
export LANGEXTRACT_SERVICE_URL='http://127.0.0.1:8767'
export LANGEXTRACT_SERVICE_TOKEN='<与 Python 服务相同的连接密钥>'
pnpm dev
```

导入 Floatboat 后，这两个变量也需提供给实际工作台服务器进程；本版没有在界面保存服务凭据的设置页。远程服务必须经 HTTPS 并保持 Bearer 鉴权；不要把无 TLS 的远程地址填入配置。未配置服务时，本地资料审校仍可用。

抽取时先保存当前项目，再提交原文、字段与已应用示例。刷新不会自动提交新任务；不确定的提交通过原 ID 查询。服务重启中断的任务需要用户明确新建；停止接收结果不能保证供应方已经取消计费。

## 输入与导出约定

每行 JSONL 包含 `document_id`、`text` 和 `extractions`；记录支持 `extraction_class`、`extraction_text`、`char_interval`、`attributes`、`alignment_status` 等上游字段。区间左闭右开。连续中文的上游对齐可能为空或模糊，需要人工核对。

“原始抽取 JSONL”始终输出抽取时原文和原始记录，不混入人工改写；“审校表 CSV”包含原始值、修订值、状态、区间、属性和备注；“完整项目 JSON”包含原文修改、配置与全部修订。文本单份最多30k字符、项目800KB，不解析扫描件或 PDF。

## 许可与上游

[LangExtract](https://github.com/google/langextract) 代码为 Apache-2.0；本工作台通过独立 Python 服务调用，不在前端复制上游内联 HTML。模型服务与权重许可单独适用。上游对健康相关用途另有条款，本版示例和用途为非医疗资料抽取。来源及许可记录见 [notices](notices/README.md)。
