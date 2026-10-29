# 第三方说明

| 包 | 版本 | 许可证 | 用途 | 许可文本 |
| --- | --- | --- | --- | --- |
| React Flow / @xyflow/react | 12.12.0 | MIT（xyflow） | 节点画布、Handle、NodeToolbar、MiniMap、Controls | `app/src/notices/react-flow.LICENSE` |
| @dagrejs/dagre | 3.1.1 | MIT（Chris Pettitt） | 「自动整理布局」的分层布局 | `app/src/notices/dagre.LICENSE` |
| @dagrejs/graphlib | 4.0.6（dagre 的依赖） | MIT（Chris Pettitt） | dagre 的图结构 | `app/src/notices/graphlib.LICENSE` |

上游：https://github.com/xyflow/xyflow、https://github.com/dagrejs/dagre。依赖以精确版本固定在项目根与 `app/` 的 package/lock 文件中，预构建 CSS 与 JS 通过锁定依赖使用。
