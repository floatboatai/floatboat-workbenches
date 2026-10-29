# ComfyUI 工作台

ComfyUI 节点工作流的完整节点编辑器：在暗色节点画布上搭图、校验、导入导出，再提交到**你自己的** ComfyUI 服务运行，并把每次运行的图片和精确参数留在文稿旁。

![ComfyUI 工作台](../../docs/screenshots/comfyui.png)

版本 0.9.0 · 状态：本地验收（对接按官方 API 编写的模拟服务）· **真实生成未验证**

## 能做什么

- **节点画布**（MIT `@comfyorg/litegraph`）：双击空白处搜索加节点，或从左侧分类库拖入；拖出连线到空白处按类型筛选；插槽类型检查；INT/FLOAT 范围与步长、多行文本、下拉（长列表带筛选）、布尔、seed “生成后控制”（固定/递增/递减/随机）；Reroute、Primitive、Note、分组、折叠、绕过（Ctrl+B）/静音（Ctrl+M）、复制粘贴、撤销重做、多选、小地图。
- **节点定义**：连接服务后使用它的 `/object_info`（自定义节点自动出现）；未连接用内置的 ComfyUI v0.43.0 核心节点快照（`app/notices/PROVENANCE.md`）。找不到节点类型的工作流以“缺失节点”占位框保留全部数据。
- **格式**：导入/导出界面工作流 JSON；导入 API 提示词 JSON（自动排布）；导出 API 格式（穿过 Reroute/Primitive，跳过静音与绕过）；导入带 `workflow`/`prompt` 元数据的 PNG。导入总是新建文稿。
- **离线校验**：缺失必填输入、类型不符、未知节点、无输出节点、范围/枚举，标在节点上并列在问题列表；服务端 `node_errors` 同样映射回节点。
- **运行**：连接设置、排队、节点进度与总进度、队列取消/中断、历史。工作台自己的服务端转发请求，只访问你配置的地址。
- **印样带**：每次运行的图片、种子、模型、采样参数；“载入这次的工作流”（新文稿）、2–4 张对比、下载含元数据的 PNG、ZIP。
- **模板**：SDXL 文生图（首屏）、图生图、放大、LoRA、局部重绘、ControlNet（仅核心节点）。
- **自动保存**：完整工作副本（含视口与未完成的导入文本），刷新恢复。

没有任何服务也能打开、编辑、校验、导出；运行入口会说明还缺什么。

## 连接你自己的 ComfyUI

1. 启动 ComfyUI：`python main.py --listen 127.0.0.1 --port 8188`（需要模型文件才能真正出图）。
2. 在工作台右侧“运行”标签填写地址（默认 `http://127.0.0.1:8188`），点“检查连接并载入节点”。
3. 需要鉴权的反向代理：展开“需要请求头令牌？”，填请求头名（如 `Authorization`）和值。令牌只保存在工作台服务进程内存；勾选“记住令牌”才写入本机数据库，且**永远不会导出**。
4. 请求由工作台的服务端发出（不带浏览器 Origin），因此**不需要** `--enable-cors-header`。ComfyUI 对浏览器的跨源请求会返回 403，这正是用服务端转发的原因。
5. 点“运行”（Ctrl+Enter）。进度来自 WebSocket，结果从服务端 `/history` 与 `/view` 取回并存入本机。

## 许可证边界

工作台为 **MIT**。不含也不分发 ComfyUI（GPL-3.0）、ComfyUI_frontend 或 comfyui-frontend-types（GPL-3.0）的代码，也不含模型权重；ComfyUI 作为用户自己的独立服务运行。内置的只是 ComfyUI 核心节点的**接口元数据**快照。逐项依赖许可证见 `app/notices/`，协议学习与快照来源见 `app/notices/PROVENANCE.md`。模型权重的许可证由用户自行核查。

## 开发

```sh
pnpm workbench prepare comfyui        # 从仓库根目录，取固定工具链
node scripts/workbench.mjs check comfyui
node scripts/workbench.mjs test comfyui
node scripts/workbench.mjs package comfyui
# 对接模拟服务手动验收
node --experimental-strip-types app/tests/support/run-mock.ts --port 8199
```

验收记录见 [ACCEPTANCE.md](ACCEPTANCE.md)，设计见 [app/DESIGN.md](app/DESIGN.md)。
