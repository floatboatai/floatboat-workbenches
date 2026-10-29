# 第三方来源与许可

[上游 Tiptap](https://github.com/ueberdosis/tiptap)，MIT License，Copyright (c) 2025 Tiptap GmbH 及贡献者。以下包均以精确版本 3.32.0 固定在项目根与 `app/` 的 package/lock 文件中：

| 包 | 用途 |
| --- | --- |
| @tiptap/react、@tiptap/core、@tiptap/pm、@tiptap/starter-kit | 编辑器、ProseMirror、基础节点与标记 |
| @tiptap/extension-list | 任务清单（TaskList / TaskItem） |
| @tiptap/extension-table | 表格（TableKit） |
| @tiptap/extension-image | 图片与缩放 |
| @tiptap/extension-highlight | 高亮 |
| @tiptap/extension-text-align | 对齐 |
| @tiptap/extensions | 占位提示、字数上限 |
| @tiptap/suggestion | 「/」插入菜单 |
| @tiptap/markdown | Markdown 解析与序列化 |

传递依赖：marked 17.0.6（MIT，Copyright Christopher Jeffrey 等）、@floating-ui/dom 1.8.0（MIT）、linkifyjs（MIT）及 ProseMirror 各包（MIT，Marijn Haverbeke）。React 19.2.3、lucide-react 0.562.0 为模板依赖（MIT / ISC）。精确版本见锁文件。

没有复制上游示例内容、外部字体或图片。示例文稿为本项目自写的普通演示内容。

应用源码许可遵循总仓库，第三方各自许可独立适用。源包不包含预览数据库、模型凭据或本地用户文件。
