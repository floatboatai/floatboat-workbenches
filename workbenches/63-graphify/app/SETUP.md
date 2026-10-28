# 安装与服务配置

本指南随工作台源码包附带。仓库级命令在[完整仓库](https://github.com/floatboatai/floatboat-workbenches)中执行，外部服务源码与锁文件位于对应项目目录；普通工作台包不包含服务运行环境。

# 知识地图 · Graphify

用真实Graphify提取源码关系，定位节点、沿有向路径追溯来源，留下独立的人工笔记。支持原生`graph.json`导入/导出，以及包含源码、布局、笔记和未应用JSON的完整项目。


## 使用

```sh
pnpm workbench prepare graphify
pnpm workbench dev graphify
```

源码提取需要独立的本机Python服务；导入已有Graphify图谱、查路径、写笔记和保存无需该服务：

```sh
cd workbenches/63-graphify
uv venv .local/python --python 3.12
uv pip install --python .local/python/bin/python -r service/requirements.lock.txt
.local/python/bin/python service/server.py --port 8781
```

可通过工作台服务进程的`GRAPHIFY_SERVICE_URL`配置地址，默认`http://127.0.0.1:8781`。仅loopback HTTP或HTTPS。服务绑定本机，不接受浏览器跨来源POST，源码由Node路由转发。源代码只被解析，不会执行，也不调用模型。每次解析使用新Python解释器和临时目录，25秒上限。

## 产品范围

- 单个Python/JavaScript/TypeScript文本文件，最多80,000字符；真实tree-sitter AST、上游build及原生序列化。
- 原生Graphify图谱最多400节点/1600关系/350KB，保留额外元数据与并行边，超限明确拒绝。
- 点击节点、检索、变焦、拖动布局、来源与关系审阅、有向/无向最短路径。笔记及位置与原生图谱分离。
- 自动保存、未应用JSON与提取候选恢复、保存失败重试、冲突保护；导入创建新项目。
- 提取候选不会自动覆盖图谱。采用新图谱会清空其旧笔记与布局，并明确确认；请先导出需要保留的项目。

不是Graphify Cloud，不包含跨仓库常驻同步、语义文档/图像模型提取或所有CLI命令。JSON和源码以文本呈现，不执行导入内容。所有示例均为普通演示代码。

## 检查与交付

```sh
pnpm workbench check graphify
pnpm workbench test graphify
pnpm workbench package graphify
```

Python服务测试：使用上面创建的解释器运行`-m unittest discover -s service -v`。

`.fbworkbench`为独立应用源码包，导入：Floatboat → 我的 → 工作台 → 导入工作台。包不含Python环境、预览数据或用户文件；服务代码在本仓库项目目录中单独部署。客户端导入尚未验证。具体证据见[ACCEPTANCE.md](https://github.com/floatboatai/floatboat-workbenches/blob/main/workbenches/63-graphify/ACCEPTANCE.md)。

上游：[Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify)。锁定`graphifyy==0.9.97`，Apache-2.0及历史MIT部分的许可/NOTICE通过只读资源随源码包提供。

恢复：支持“导出工作稿”的完整恢复文件，优先采用最新snapshot并保留未应用extra。导入总是新项目；旧执行关联仅作历史记录，不自动重跑。新建、打开与导入期间锁定编辑，待旧工作稿保存完成后切换。
